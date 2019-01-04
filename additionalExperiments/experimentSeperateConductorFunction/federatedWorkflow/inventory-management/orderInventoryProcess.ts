import {APIGatewayEvent, Callback, Context, Handler} from 'aws-lambda';
// import entire SDK
const AWS = require('aws-sdk');
let lambda;


export const startOrderInventoryWorkflow: Handler = (event: APIGatewayEvent, context: Context, cb: Callback) => {

    lambda = new AWS.Lambda();

    let order;
    let httpBody;
    if ((<any> event).body) httpBody = JSON.parse(event.body);
    // lambda is invoked directly from the lambda console
    if (event && (<any> event).order && (<any> event).order.items) {
        order = (<any> event).order;
    // Lambda is invoked by the API Gateway
    } else if (httpBody && httpBody && httpBody.items) {
        order = httpBody;
    } else {
        const errorResponse = {
            name: "No order",
            message: 'An error occurred while checking inventory!',
            body: {
                error: "No order",
                requestPayload: event,
                httpBody: httpBody
            }
        };
        cb(new Error(JSON.stringify(errorResponse)), null);
    }
    console.log("New Order arrived for Inventory Process: " + JSON.stringify(order));

    let taskOne = checkInventoryLambda(process, order);

    let taskTwo = taskOne.then(checkInventoryResult => {
        // TODO Handle not available stock
        return decreaseStockLevelsLambda(process, order);
    });


    let taskThree = taskTwo.then(decreaseStockLevelsResult => {
        return createPicklistLambda(process, order);
    });

    let taskFour = taskThree.then(CreatePicklistResult => {
        const response = {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Inventory process finished!',
                items: CreatePicklistResult,
            }),
        };
        cb(null, response);
    }).catch(err => {
        const errorResponse = {
            statusCode: 200,
            name: err,
            message: 'An error occurred while checking inventory!',
            body: {
                message: 'An error occurred while checking inventory!',
                error: err
            }
        };

        cb(new Error(JSON.stringify(errorResponse)), null);
    });
};

function checkInventoryLambda(process, order) {

    return new Promise((resolve, reject) => {
        let ctx = {
            client: {process: 'orderInventoryProcess'}
        };
        let payload = {
            items: order.items
        };



        let params = {
            ClientContext: AWS.util.base64.encode(JSON.stringify(ctx)),
            FunctionName: (<any> process.env).checkInventoryFunctionName,
            InvocationType: "RequestResponse",
            LogType: "Tail",
            Payload: JSON.stringify(payload),
            // Qualifier: "1"
        };
        lambda.invoke(params, (err, data) => {
            if (err) reject(err); // an error occurred
            else resolve(data); // successful response
        });
    });
}

function decreaseStockLevelsLambda(process, order) {
    return new Promise((resolve, reject) => {
        let ctx = {
            client: {process: 'orderInventoryProcess'}
        };
        let payload = {
            items: order.items
        };

        let params = {
            ClientContext: AWS.util.base64.encode(JSON.stringify(ctx)),
            FunctionName: (<any> process.env).decreaseStockFunctionName,
            InvocationType: "RequestResponse",
            LogType: "Tail",
            Payload: JSON.stringify(payload),
            // Qualifier: "1"
        };
        lambda.invoke(params, (err, data) => {
            if (err) reject(err); // an error occurred
            else resolve(data); // successful response
        });
    });
}

function createPicklistLambda(process, order) {
    return new Promise((resolve, reject) => {
        let ctx = {
            client: {process: 'orderInventoryProcess'}
        };
        let payload = {
            order: order
        };

        let params = {
            ClientContext: AWS.util.base64.encode(JSON.stringify(ctx)),
            FunctionName: (<any> process.env).createPicklistFunctionName,
            InvocationType: "RequestResponse",
            LogType: "Tail",
            Payload: JSON.stringify(payload),
            // Qualifier: "1"
        };
        lambda.invoke(params, (err, data) => {
            if (err) reject(err); // an error occurred
            else resolve(data); // successful response
        });
    });
}