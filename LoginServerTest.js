/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */


function mongoEventHandler (req, res)
{
    // Local Variable Declaration 
    let dbName = "admin", colName = "users"; 
    let result = "NULL"; 
    
    /* Here you might do some preprocessing of the request header/data to find
     * out which account the user wants to access */
     
    // Connect to the MongoDatabase Sever 
    MongoClient.connect(dbURL, function (error, conn) // Once the connection is made this function will be called. Here is where any queries or changes can be made to the database
    {
        // First check for any errrors 
        if (error !== null)
        {
            // Print the error
            console.log(error);
            
            // Throw the error
            throw error;
        }
        else 
            console.log("Connection Successful");
        
        // Get a database reference object to the database we want to connect to
        let dbObj = conn.db(dbName);
        
        // Get a cursor to the dataSet containing all the entries in the collection requested by the user
        let selector = dbObj.collection(colName).find({});
        
        // Get an array representing all the entries in the cursor
        selector.toArray(function (error, docs)
        {
            // Check for any errors fisrt
            if (error !== null)
            {
                // Print the error
                console.log(error);
                
                // Throw the error
                throw error;
            }
            
            // Now print out the contents of the cursor
            console.log(docs);
            
            /* Serialize the object and assign it to a result that will be sent
             * back to the caller of this server */
            result = JSON.stringify(docs);     
            
            // Pass the result to a method that gets called to pass back result 
            serverResponse (result, res);
        });
        
        // Close the conneciton 
        conn.close(); 
    });
    
    /*************************** Server Logic *********************************/
//    // Create a response header. Tell the client that their request is allowed
//    res.writeHead(httpStatus.OK, 
//    {'Content-Type':'text/plain', 
//     'Access-Control-Allow-Origin': '*'
//    }); 
//    
//    // Now print this back to the server caller
//    res.write(JSON.stringify(result));
//    res.end();
}

function mongoPromiseEventHandler (req, res)
{
    // Local Variable Declaration 
    let dbName = "admin", colName = "users"; 
    let result = "NULL"; 
    
    /* Here you might do some preprocessing of the request header/data to find
     * out which account the user wants to access */
     
    // Connect to the MongoDatabase Sever with a promise
    MongoClient.connect(dbURL).then(function (client) // Once the connection is made this function will be called. Here is where any queries or changes can be made to the database
    { 
        /* Once the promise is fulfilled, ie the connection has been established
         * go ahead and begin fetching your infomation */
            console.log("Connection Successful");
        
        // Get a database reference object to the database we want to connect to
        let dbObj = client.db(dbName);
        
        // Get a cursor to the dataSet containing all the entries in the collection requested by the user
        let selector = dbObj.collection(colName).find({});
        
        // Get an array representing all the entries in the cursor
        selector.toArray().then(function (docs)
        {
            console.log ("Got our data");
                       
            /* Serialize the object and assign it to a result that will be sent
             * back to the caller of this server */
            result = JSON.stringify(docs);     
            
            // Now print out the contents of the cursor
            console.log("The users: " + result);
            
            // Pass the result to a method that gets called to pass back result 
            serverResponse (result, res);
        }).catch(function (error) // Catch any errors
            {
                // Check for any errors fisrt
                if (error !== null)
                {
                    // Print the error
                    console.log(error);

                    // Throw the error
                    throw error;
                }
            });
        
        // Close the conneciton 
        client.close(); 
        
    }).catch(function (error)
        {
            console.log(error);

            throw error; 
        });
}

// Server GET Call handler that makes use of async/await operations
function mongoAsyncEventHandler (req, res)
{
    // Local Variable Declaration 
    let dbName = "admin", colName = "users", dbURL = "mongodb://localhost:27017"; 
    let result = "NULL"; 
    const client = new MongoClient(dbURL);
    
    /* Here you might do some preprocessing of the request header/data to find
     * out which account the user wants to access */
     
     /* Immediately Invoked Function Expression to give async context for async
      * functionality */
     (async function()
     {
         try
         {
            // Wait for the Mongo client to connect to the MongoDatabase Sever 
            await client.connect();

            /* Once the promise is fulfilled, ie the connection has been established
             * go ahead and begin fetching your infomation */
            console.log("Connection Successful");
                        
            // Get a database reference object to the database we want to connect to
            let dbObj = client.db(dbName);

            // Get a cursor to the dataSet containing all the entries in the collection requested by the user
            let selector = dbObj.collection(colName).find({});
        
            /* Ask for an array containing all the documents (records) in the 
             * cursor. Wait for the driver to respond before continuing */
            const docs = await selector.toArray();
            
            // Now we have our data process it.
            console.log ("Got our data");

            /* Serialize the object and assign it to a result that will be sent
             * back to the caller of this server */
            result = JSON.stringify(docs);     

            // Now print out the contents of the cursor
            console.log("The users: " + result);

            // Pass the result to a method that gets called to pass back result 
            serverResponse (result, res);

            // Close the conneciton 
            client.close(); 
        }
        catch (error)
        {
            console.log(error);
        
            throw error; 
        }
    })();
}

// Method to preform server logic in time with database results
function serverResponse(message, serverRes)
{
    // Create a response header. Tell the client that their request is allowed
    serverRes.writeHead(httpStatus.OK, 
    {'Content-Type':'text/plain', 
     'Access-Control-Allow-Origin': '*'
    }); 
    
    // Now print this back to the server caller
    serverRes.write(message);
    serverRes.end();
}

function getJSONString (obj)
{
    return JSON.stringify(obj, null, 2);
};

function mongoCallBack(error, client)
{
    // See if there are any errors
    if (error) 
    {
        console.log("error: " + error);
        throw error;
    }
    
    console.log("Connected successfully"); 
    
    // Get the database reference from Mongo from the connection object
    let db = client.db(dbName);
    
    // Turn the users collection into an Array and then get all the users
    db.collection("users").findOne({},(error, data) => 
        {
           // Check for query errors
           if (error)
           {
               throw error;
           }
         
           // Print the user name and password (document)
           console.log("The users: " + JSON.stringify(data));
           
           // Send the data back through the server response 
           client.close();
        });    
};