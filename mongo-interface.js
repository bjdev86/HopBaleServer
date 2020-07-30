/* 
 * Date Created: 7/26/2019
 * 
 * Description: Module to create an interface between the user database and Login
 *              Server.
 *              
 * TODO:   
 *      1. Should querrying methods return an error or a message if a querry is
 *      formatted apropriately, but doesn't actually change any database record.
 *      For example if the query seeks to modify a property that does not exsist.
 */

/* MongoDB Configuration these will be the initial configuration settings for 
 * connecting to the database containt user data. */
const MongoClient = require('mongodb').MongoClient,
      dbURL = "mongodb://localhost:27000,localhost:27001/?replicaSet=ars",
      dbName = "HopBales", // The database where user data is stored
      colName = "bales", // The collection where user data is stored. 
      client = new MongoClient(dbURL, {useNewUrlParser : true});


/* Constants to define names for Error objects used in this module.*/
const ERR_NME = "DB_Error";

                            
// Exported constants.
exports.ERR_NME = ERR_NME;

// DB Method execution map 


// Connect to the database server, and return the connected client.
exports.connect = async function()
{
    // Local Variable Declaration 
    let conncectedClient; 
    
    try
    {
        /* Create a new MongoClient that will connect to the database and be the
         * basis of the session with the database */
        conncectedClient = new MongoClient(dbURL, {useNewUrlParser : true});
        
        // Connect to the database server
        await conncectedClient.connect();
    }
    catch (error)
    {
        /* Create a new Error that containts the stack trace and message from 
         * the original error */ 
        let thisError = new Error(error.stack + "\n" + error.message);
        
        // Give the errror a name so that it can be distinguished later on.
        thisError.name = ERR_NME; 
        
        // Print the error to the console for debugging purposes.
        console.log(thisError);
        
        // Throw the error back up to the caller to deal with
        throw thisError;         
    }
    
    return conncectedClient; 
};

/* Method to create a Session that will be used for preforming transactions on 
 * the database that this interface will connect to. The connection data, 
 * recieved by this method will be used to connect to the database and a Session
 * generated by the Mongo Server, based on those connection credentials will be
 * passed back.*/
exports.startSession = async function(connectedClient)
{
    // Local Variable Declaration 
    let clientSession;
    let transOpts = 
    {
       readConcern : {level: 'majority'}, 
       writeConcern : {w : 'majority', wtimeout : "5000"}
    }; 
        
    try 
    {         
        // Start a new session from the connected client 
        clientSession = connectedClient.startSession(
                                        {defaultTransactionOptions: transOpts}); 
    }
    catch (error)
    {
        /* Create a new Error that containts the stack trace and message from 
         * the original error */ 
        let thisError = new Error(error.stack + "\n" + error.message);
        
        // Give the errror a name so that it can be distinguished later on.
        thisError.name = ERR_NME; 
        
        // Print the error to the console for debugging purposes.
        console.log(thisError);
        
        // Throw the error back up to the caller to deal with
        throw thisError;         
    }
   
    return clientSession;
};

exports.endSession = async function (session)
{
    try
    {
        // End any transaction going on with the session 
        //await session.commitTransaction();
        
        // End the session with the database server
        await session.endSession();
    }
    catch (error)
    {
        console.log("Error ending session: " + error.message);
    }
};

exports.disconnect = async function (client)
{
    try 
    {
        await client.close();
    }
    catch (error)
    {
        console.log("Error closing the client connection: " + error.message);
    }
};

/* Method to get user data from the databaase based on the querry object passed,
 * which is expected to contain the requested user name as a value to the 
 * variable that has the same name as it does in the database. The method will 
 * use a mongo session on which to preform the transaction. The transaction will
 * be commited immeadately after it is created. The session will remain active
 * after the transaction has been completed. The method will also take a 
 * connected client used to get a Data Base reference on which db commands will
 * be executed. The connection will remain connected after the transaction is 
 * complete.*/      
exports.getRecords = async function(qryObj, client, session)
{
    // Local Variable Declaration
    let dbRef, result, cursor;
    
    try 
    {        
        // Start a new transaction for the session passed.
        session.startTransaction();
         
        // Get a reference to the database where user data is stored
        dbRef = client.db(dbName); 

        /* Querry the database for the requested user get a cursor to all the 
         * users found by this querry object */
        cursor = await dbRef.collection(colName).find(qryObj.qry,
                                                     {projection: qryObj.proj,
                                                       sesssion: session});

        // Have the cursor return an array of all the documents found in the querry
        result = await cursor.toArray();
          
        // Commit to the transactions preformed in this sesssion to the database
        await session.commitTransaction();         
    }
    catch (error)
    {
        // Abort the transaction 
        await session.abortTransaction();
        
        /* Create a new Error that containts the stack trace and message from 
         * the original error */ 
        let thisError = new Error(error.stack + "\n" + error.message);
        
        // Give the errror a name so that it can be distinguished later on.
        thisError.name = ERR_NME; 
        
        // Print the error to the console for debugging purposes.
        console.log(thisError);
        
        // Throw the error back up to the caller to deal with
        throw thisError;         
    }
     
    return result;
};

/* Method to update a user with a new userName. Method will 
 * return a resolved promise with a value of 1 or 0. 1 will indicate the update 
 * was a success and a 0 will indicate the update was a failure */
exports.updateRecords = async function(qryObj, client, session)
{    
    // Local Variable Declaration
    let dbRef, result;
    
    try 
    {
        /* Start a transaction. Commands executed after this statement will be
         * executed with options specified in the transaction and session objects*/
        session.startTransaction(); 
                      
        // Get a reference to the database where user data is stored
        dbRef = client.db(dbName); 
        
        // Preform the update on the collection in the database 
        result = await dbRef.collection(colName).updateMany(qryObj.qry,
                                      qryObj.update, {sesssion: session});
                                                           
        // Commit to the transactions preformed in this sesssion to the database
        await session.commitTransaction(); 
    }
    catch (error)
    {
        // Abort the transaction 
        await session.abortTransaction();
        
        /* Create a new Error that containts the stack trace and message from 
         * the original error */ 
        let thisError = new Error(error.stack + "\n" + error.message);
        
        // Give the errror a name so that it can be distinguished later on.
        thisError.name = ERR_NME; 
        
        // Print the error to the console for debugging purposes.
        console.log("Update Record Error: " + thisError);
        
        // Throw the error back up to the caller to deal with
        throw thisError;         
    }
   
    return result.result.ok;
};

/*
/* Method to create a new record in the users collection. The method will take 
 * in the data for the new user and will return a success or fail parameter.*/
exports.createRecords = async function(qryObj, client, session)
{
 // Local Variable Declaration
    let dbRef, result;
        
    try 
    {         
        /* Start a transaction. Commands executed after this statement will be
         * executed with options specified in the transaction and session objects*/
        session.startTransaction(); 
                
        // Get a reference to the database where data is stored
        dbRef = client.db(dbName);
       
        // Insert the new record into the database
        result = await dbRef.collection(colName).insertMany(qryObj.nwdt, {session: session});
        
        // Commit to the transactions preformed in this sesssion to the database
        await session.commitTransaction(); 
    }
    catch (error)
    {
       // Abort the transaction 
       await session.abortTransaction();
       
       /* Create a new Error that containts the stack trace and message from 
        * the original error */ 
        let thisError = new Error(error.stack + "\n" + error.message);
        
        // Give the errror a name so that it can be distinguished later on.
        thisError.name = ERR_NME; 
        
        // Print the error to the console for debugging purposes.
        console.log(thisError);
        
        // Throw the error back up to the caller to deal with
        throw thisError;  
    }
   
    return result.result.ok;
};

/* Method to delete a user from the users collection. Method will return a 
 * resolved promise with a value of 1 or 0. 1 will indicate the deletion was a 
 * success and the 0 will indicate the deletion was a failure.*/
exports.deleteRecords = async function(qryObj, client, session)
{
    // Local Variable Declaration 
     let dbRef, theResult;
    
    // Preform the deletion process inside a try catch block
    try 
    {
        /* Start a transaction. Commands executed after this statement will be
         * executed with options specified in the transaction and session objects*/
        session.startTransaction(); 
                
        // Get a reference to the database where data is stored
        dbRef = client.db(dbName);
        
        // Atempt the deletion of a user
        theResult = await dbRef.collection(colName).deleteMany(qryObj.qry, 
                                           {session: session});
        
        // Commit to the transactions preformed in this sesssion to the database
        await session.commitTransaction(); 
    }
    catch (error)
    {
        // Abort the transaction 
        await session.abortTransaction();
       
        /* Create a new Error that containts the stack trace and message from 
         * the original error */ 
        let thisError = new Error(error.stack + "\n" + error.message);
        
        // Give the errror a name so that it can be distinguished later on.
        thisError.name = ERR_NME; 
        
        // Print the error to the console for debugging purposes.
        console.log(thisError);
        
        // Throw the error back up to the caller to deal with
        throw thisError;         
    }
    
    return theResult.result.ok;
};

/**
 * 
 * @param {Object} qryObj
 * @param {String} client 
 * @param {Session} session 
 * @returns {undefined}
 */
exports.doAggregation = async function(qryObj, client, session)
{
    // Local Variable Declaration 
     let dbRef, theResult, agCursor;
    
    // Preform the deletion process inside a try catch block
    try 
    {
        /* Start a transaction. Commands executed after this statement will be
         * executed with options specified in the transaction and session objects*/
        session.startTransaction(); 
                
        // Get a reference to the database where data is stored
        dbRef = client.db(dbName);
        
        // Atempt the aggregation command on the collection. Get an aggregation cursor
        agCursor = await dbRef.collection(colName).aggregate(qryObj.pipeLine, 
                                                             {session: session});
        
        // Convert the aggregation cursor to an array 
        theResult = await agCursor.toArray();
        
        // Commit to the transactions preformed in this sesssion to the database
        await session.commitTransaction(); 
    }
    catch (error)
    {
        // Abort the transaction 
        await session.abortTransaction();
       
        /* Create a new Error that containts the stack trace and message from 
         * the original error */ 
        let thisError = new Error(error.stack + "\n" + error.message);
        
        // Give the errror a name so that it can be distinguished later on.
        thisError.name = ERR_NME; 
        
        // Print the error to the console for debugging purposes.
        console.log(thisError);
        
        // Throw the error back up to the caller to deal with
        throw thisError;         
    }
    
    return theResult;
};
