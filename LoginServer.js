/**
 * 
 * @ author: Ben Miller
 */

const http = require('http');
const httpStatus = require ('http-status-codes');
const port = 3002; 
const listeningURL = "127.0.0.1"; // localhost

/* Include (Import) the database interface so this server can interact with the
 * database */
const UserDBInterface = require('./mongo-interface.js');

// DB Method execution map 
const dbMethodMap = new Map([["get_usr", UserDBInterface.getRecords],
                             ["chng_usr", UserDBInterface.updateRecords],
                             ["dlt_usr", UserDBInterface.deleteRecords], 
                             ["crt_usr", UserDBInterface.createRecords],
                             ["rd_usr", UserDBInterface.sessionRead],
                             ["test", UserDBInterface.dummySession]]);

// Error Name Constants
const DB_EXE_ERR = "ExeDBCommand"; 

// Custom Response Headers 
const 
OPTION_HEADER = 
{
    'Content-Type':'text/plain',
    'Access-Control-Allow-Origin':'*',
    'Access-Control-Allow-Headers': 'x-dbcommand, x-cmmd', // Custom headers
    'Access-Control-Allow-Method': 'POST, OPTIONS, GET'
},
FORBBIN_HEADER =
{
    'Content-Type': "text/plain",
    'Content' : "HTTP 403 Access Forbidden"
},
POST_RESPONSE_HEADER =
{
    'Content-Type':'text/plain',
    'Access-Control-Allow-Origin':OPTION_HEADER['Access-Control-Allow-Origin']
};

// Serve reponse to pinging this server which will display the Hop tracker app
function mainHandler(req, res)
{   
  
    
    console.log("URL: " + req.url + "\n" + "Method: " + req.method
            + "\n" + "Headers: " + JSON.stringify(req.headers, null, 2) + "\n"); 
    
    // Handle OPTIONS header requests which are sent with pre-flight CORS requests
    if (req.method === "OPTIONS")
    {
        // Pass the call onto the OPTION header handler
        optionHeaderHandler(req, res);
    }
    
    /* Handle POST header requests sent when a post reqeust for data is made. 
     * POST requests are */
    else if (req.method === "POST")
    {
        // Pass the call on to the POST header handler
        postHeaderHandler(req, res);
    }
    
    /* See if the request was a GET request. GET requests will carry the query
     * and update data in the URL*/
    else if (req.method === "GET")
    {
        /*@TODO: Create handler to for get requests*/
    }
 };
 
/* Method to handle OPTION header requests. The method will send back the 
 * appropriate header information in a header to the client.*/
function optionHeaderHandler (req, res)
{
    // Check to make sure the origin of the client request was acceptable
    if (OPTION_HEADER['Access-Control-Allow-Origin'] === "*" || 
        req.headers['origin'] === OPTION_HEADER['Access-Control-Allow-Origin'])
    {
        serverResponse("These are the options that are okay", res, 
                        httpStatus.OK, OPTION_HEADER);
    }
    // If the request origin is not allowed then tell the client so.
    else 
    {
        serverResponse("Access from this origin is forbbin", res, 
                        httpStatus.FORBIDDEN, FORBBIN_HEADER);
    }   
}

/* Method to handle POST requests made to this server. This is the main type of
 * request that will be made to this server. The post request will contain a 
 * data request that this server will preform against the database. The results
 * will be returned to the client. */
function postHeaderHandler (req, res)
{
    // Local Variable Declaration 
    let requestData = "", dbCommand = "";
   
    // Get the database command from the url sent with this request
    dbCommand = req.headers["x-dbcommand"]; 


    /* Get the data from the request. Add an "incoming data listener" handler
     * method to the request object to handle incoming data chunks from the 
     * client making the request */
     req.on("data", function (chunk)
     {
        // Add the data from the request 
        requestData += chunk; 
     })
    /* Add a "data has finished coming in" event handler to the request being
     * made by the client making a request. When the data has been fully recieved
     * then issue the command the client sent against the database. Pass back any
     * result the database gave including errors. Create an asynchronous context 
     * in which data base commands can be executed, and server responses can be 
     * issued. DB commands are executed asynchronously in a seperate thread apart 
     * form this main thread.*/
    .on("end", async function ()
    {
        // Local Variable Declaration 
        let querryObj = undefined;
        let reqResult = "";
        let hsc = httpStatus.OK; // Initialize the http status as OK

        try
        {
            // Body should be complete 
            console.log("The Body on the server is: " + requestData);

            // Parse Object from the JSON string passed 
            querryObj = JSON.parse(requestData); // This operation is expensive, REFACTOR IT!

            // Execute the database command which will produce a result.
            reqResult = await exeDBCmmd(querryObj, dbCommand);    
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

            /* Set the error status code to reflect there was an error processing
             * the client's request */
            hsc = httpStatus.INTERNAL_SERVER_ERROR;
        }
        
        // Write the response back to the client
        serverResponse(reqResult, res, hsc, POST_RESPONSE_HEADER);     
    })
    /* Add an error handler for data stream errors. */        
    .on("error", function (error)
    {
        // Local Variable Declaration 
        let errMsg = "";
        let hsc = "";

        // Log the error to the console for debugging
        console.log(error);

        // Create a error response message to be sent back to the calling client
        errMsg = "Data Stream Error in " + new Error().stack + "\n" + error.message;

        // Set the server status code regarding the error caught.
        hsc = httpStatus.BAD_REQUEST;

        // Write the response back to the client
        serverResponse(errMsg, res, hsc, POST_RESPONSE_HEADER);     
    });
}
 
//********************************HELPER METHODS********************************
/* Method to execute a command against the database. The mehtod takes in the data
 * gathered from upstream from the client, and the database command passed from
 * the client.*/
async function exeDBCmmd(data, dbCommand)
{
    // Local Variable Declaration 
    let dbResponse = "null"; 
       
    // Check to see the DB request being made is defined in the db method map
    if (dbMethodMap.has(dbCommand))
    {
        try 
        {  
            // Get the user data and turn it into a string 
            dbResponse = await dbMethodMap.get(dbCommand)(data);
            
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
            let eMessage = (UserDBInterface.ERR_NME === error.name) ?                  
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

/* Method to formulate a response to a client request. The method takes in a 
 * message to be sent back to the client and the http response object associated
 * with this server so the response can be made */
function serverResponse(message, serResponse, statCode, header)
{
    // Calcualte the Content-Length Header 
    header['Content-Length'] = (Buffer.byteLength(message, "utf8") * 1); 
    
    // Create a response header. Tell the client that their request is allowed
    serResponse.writeHead(statCode, header); 
    
    // Now print this back to the server caller
    serResponse.write(message);
    serResponse.end(); // Close the stream. Send the header and the message
}

// Create the server that will handle the requests for the Hop Tracker App
let theServer = http.createServer(mainHandler); 

// Tell the server to listen on port 3001 on the localhost
theServer.listen(port, listeningURL);

