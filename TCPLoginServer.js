/* 
 * Date: 8/15/2019
 * 
 * Server to interact with the user database using the TCP protocol and web 
 * sockets. The server acts a interface between the client and the server.
 *
 * Version: 1.0
 * 
 * TODO: 
 * 
 * 1. Look into subprotocols.
 * 
 * 2. Sending close events.
 * 
 * 3. Move dbMethodMap to the mongo-interface.
 */

// Import some modules
const net = require('net');
const mysocketIO = require("./socketIO.js");
const mongoInterface = require ("./mongo-interface");

// Class Constants
const port = 3003;
const host = "localhost"; // Local Host 
const dbMethodMap = new Map([["get_rcd", mongoInterface.getRecords],
                             ["chng_rcd", mongoInterface.updateRecords],
                             ["dlt_rcd", mongoInterface.deleteRecords], 
                             ["crt_rcd", mongoInterface.createRecords],
                             ["do_agg", mongoInterface.doAggregation]
                            ]);

// Error Name Constants
const DB_EXE_ERR = "ExeDBCommand"; 
                         
// Create a TCP server 
const server = net.createServer(); 

// Create a sessions object to associate data with a socket connection. 
const __sessions = {}; 

/* Create a session data object to contain the information to be associated with
 * each socekt connection that is made to this server from a client */
class SessionData
{
    constructor (connectedClient, mongoSession)
    {
        this.__dbClient = connectedClient;
        this.__dbSession = mongoSession;
    }
};
//const __sessionData = {dbSession: null};

// Set the connection event fired when connections to this serve are made.
server.on("connection", function(socket)
{
    // Method to handle the setup and management of a socket.
    socket = mysocketIO.configureSocket(socket, initializeDB, parseDBString, 
                                        closeDBConnection);
});

// Set the server listening on the preset port and host
server.listen(port, host, function ()
{
    // Tell the admin the server is running 
    console.log("The server is listening @ " + host + ":" + port);
});

/* Method to be fired when a socket connection is successfully established. It 
 * will add a session to the session queue. That session will be referenced by
 * the name of the user of the socket and will contain a session with the data
 * base. */
async function initializeDB(socket)
{ 
    try 
    {
        // Create get a connection to the database
        let connectedClient = await mongoInterface.connect();
        
        // Create a database session from the database connection just acquired
        let aSession = await mongoInterface.startSession(connectedClient);

        /* Add the sesssion data to the sessions object. Create a MongoDB session to
         * be used by the socket owner each time they issue a database command */
        __sessions[socket.ownerName] = new SessionData(connectedClient, aSession);
    }
    catch (error)
    {
        
    }
};

/* Method to handle close events on the socket connecting this server to the 
 * client. The method will make sure the MongoDB session is closed for the user.
 * Next the Mongo server connection will be closed. Finally the socket will be 
 * removed from the list of sockets tracked by this server. */
async function closeDBConnection(socket)
{
    // Log out of the database server
    
    // Close the db session 
    mongoInterface.endSession(__sessions[socket.ownerName].__dbSession);
    
    // Close the db connection 
    mongoInterface.disconnect(__sessions[socket.ownerName].__dbClient);
    
    // Remove the socket connection from the sessions object
    delete __sessions[socket.ownerName]; 
    console.log("Was closed: " + Object.keys(__sessions).length);
}

/* Method to parse the execution string sent over the web socket to this server.
 * The client will send a string containing a db command and the query object 
 * used to execute that db command. The query object will be in JSON form and 
 * will need to be reconstituted (parsed) before being used to execute the 
 * command. */
async function parseDBString (socket, dbString)
{
    // Local Variable Declaration 
    let querryObj = undefined;
    let reqResult = "", dbCommand = "", usrName = "";  
    let dbStringTokens = []; 

    // Split db string up over the expected delimiters 
    dbStringTokens = dbString.split("|");
    
    // Get the user name 
    usrName = dbStringTokens[0];
    
    // Get the database command 
    dbCommand = dbStringTokens[1]; 
   
    // Attempt to excute a mongodb command
    try
    {
        // Parse the querry object from the JSON string parsed from the dbString
        querryObj = JSON.parse(dbStringTokens[2]); // This operation is expensive, REFACTOR IT!

        // Execute the database command which will produce a result.
        reqResult = await exeDBCommand(dbCommand, querryObj, 
                                       __sessions[usrName].__dbClient,
                                       __sessions[usrName].__dbSession);    
        console.log("DB response: " + JSON.stringify(reqResult));   
        // Send the result back to the client
        mysocketIO.send(socket, reqResult);
    }
    catch (error)
    {

        // Scope (Block) Variable Declaration 
        reqResult = "Data Processing Error in \n" + 
                /* Check to see if the error caught was from JSON parsing or 
                 * was from executing a database command and print the 
                 * appropriate stack trace. */
                (error.name === DB_EXE_ERR ? new Error().stack : error.stack) + 
                    "\n" + error.message; 

        // Print the error to the console for debugging purposes
        console.log(reqResult);

        // Send the database result back to the client.
        mysocketIO.send(socket, reqResult);
        
        // Close the socket connection 
        /* Set the error status code to reflect there was an error processing
         * the client's request. Something to develop for future reference. */
        //hsc = httpStatus.INTERNAL_SERVER_ERROR;
    }
}


/* Method to execute a db command against the database to which this server is 
 * connected. The method will be called after the frame with the database command
 * is recieved by this server and will execute the command, and return the result
 * back to the client. */
async function exeDBCommand (dbCommand, qryObj, dbConnection, dbSession)
{
    // Local Variable Declaration 
    let dbResponse = "null"; 
       
    // Check to see the DB request being made is defined in the db method map
    if (dbMethodMap.has(dbCommand))
    {
        try 
        {  
            // Execute the database query  
            dbResponse = await dbMethodMap.get(dbCommand)(qryObj, dbConnection, 
                                                          dbSession);
            
            // Searilize the response object
            dbResponse = JSON.stringify(dbResponse);  
        }
        catch (error)
        {
            /* Formulate the error message based the name of the error passed.
             * If the error passed has the same name as used in the DB interface 
             * module then create a stack trace that is based off of the current 
             * location the error was caught which is right here. Otherwise if 
             * the name of the error caught doesn't match the name used for 
             * errors thrown by the db interface then use the stack trace and 
             * message stored in the error caught. */
            let eMessage = (mongoInterface.ERR_NME === error.name) ?                  
                                (new Error().stack + "\n" + error.message):
                                (error.stack + "\n" + error.message); 
                
            
            /* Create a local error with the message that contains the message 
             * previously formulated */
            let __error = new Error(eMessage);
            
            // Change the name of the error 
            __error.name = DB_EXE_ERR; 
            
            // Print any errors to the console for debugging purposes
            console.log("Object serialization error: " + __error);
            
            // Throw the newly formulated error
            throw __error;
        }
    }
    else 
    {
        // A bad request was made send an error message back to the client
        throw new Error( new Error().stack + "\nInvalid Database Command: " + 
                         dbCommand + " is undefined.");
    }
        
    return dbResponse;
}

