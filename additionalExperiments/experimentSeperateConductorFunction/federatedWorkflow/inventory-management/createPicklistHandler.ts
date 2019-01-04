import {APIGatewayEvent, Callback, Context, Handler} from 'aws-lambda';
// import entire SDK
const AWS = require('aws-sdk');
let lambda;

export const hello: Handler = (event: APIGatewayEvent, context: Context, cb: Callback) => {

    lambda = new AWS.Lambda();

    let order;
    if (!(<any> event).order) {
        return {error: "No order"}
    } else {
        order = (<any> event).order;
    }

    getProductLocationsLambda(process, order).then(getProductLocationsResponse => {
        const response = {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Picklist created!',
                items: getProductLocationsResponse,
            }),
        };
        cb(null, response);
    }).catch(err => {
        const errorResponse = {
            statusCode: 200,
            name: err,
            message: 'An error occured while creating picklist!',
            body: JSON.stringify({
                message: 'An error occured while creating picklist!',
                error: err
            })
        };

        cb(errorResponse, null);
    });
};

function getProductLocationsLambda(process, order) {
    return new Promise((resolve, reject) => {
        let ctx = {
            client: {lambda: 'createPicklistHandler'}
        };
        let payload = {
            items: order.items
        };

        let params = {
            ClientContext: AWS.util.base64.encode(JSON.stringify(ctx)),
            FunctionName: (<any> process.env).getProductLocationsFunctionName,
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