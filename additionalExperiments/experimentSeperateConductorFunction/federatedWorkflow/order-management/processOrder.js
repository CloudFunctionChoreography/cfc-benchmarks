'use strict';

const openwhisk = require('openwhisk');
const https = require('https');
let ow;

const CancelCause = {
    "PAYMENT_FAILED": -1,
    "INVENTORY_NOT_AVAILABE": -2
};

const Branch = {
    "PAYMENT_FAILED_BRANCH": "payment-failed-branch",
    "REGULAR_BRANCH": "regular-branch"
};

function startOrderWorkflow(params) {

    ow = openwhisk();
    if (!params.order || !params.order.items) {
        // TODO send appropriate error response code
        return {payload: {error: `No order`, requestPayload: params}};
    }


    let branch = Branch.REGULAR_BRANCH;
    let orderRecieptResult;
    let databaseEntry;

    console.log("Start order processing for order id: " + params.order.id);


    /** Chaining Promises as control flow for the Business Process.
     *  This is a waterfall: Each task starts when the last one completed successfully. **/

    /** 1. Check payment **/
    let taskOne = ow.actions.invoke({
        actionName: params.ENVIRONMENT.checkPaymentActionName,
        params: {order: params.order},
        blocking: true
    });

    let taskTwo = taskOne.then(paymentResult => {
        let paymentCheckResult = paymentResult.response.result;
        console.log("Payment was checked, result: " + paymentCheckResult.paymentSuccess);

        if (!paymentCheckResult.paymentSuccess) {
            branch = Branch.PAYMENT_FAILED_BRANCH;
            /** 1.1 If no payment: send cancellation e-mail + return cancel response **/
            return cancelOrder(params.order, params.ENVIRONMENT, CancelCause.PAYMENT_FAILED);
        } else {
            /** 2. Trigger inventory process **/
            return startInventoryProcess(params.order);
            // TODO:
            /** 2.1 If inventory error: send cancelation e-mail + return cancle response **/


        }
    });

    let taskThree = taskTwo.then(inventoryProcessResult => {
        if (branch == Branch.REGULAR_BRANCH) {
            console.log("Inventory process finished, result: " + inventoryProcessResult);

            /** 3. Create payment reciept **/
            return ow.actions.invoke({
                actionName: params.ENVIRONMENT.createPaymentRecieptActionName,
                params: {item: params.order},
                blocking: true
            });
        }
    }).catch(inventoryProcessError => {
        console.log(inventoryProcessError);
        return inventoryProcessError;
    });

    let taskFour = taskThree.then(recieptResult => {
        if (branch == Branch.REGULAR_BRANCH) {
            orderRecieptResult = recieptResult.response.result;
            console.log("Reciept was generated, result: " + orderRecieptResult);


            /** 4. Persist order **/
            return ow.actions.invoke({
                actionName: params.ENVIRONMENT.persistOrderActionName,
                params: {item: params.order},
                blocking: true
            });
        }
    });

    let taskFive = taskFour.then(persistingResult => {
        if (branch == Branch.REGULAR_BRANCH) {
            databaseEntry = persistingResult.response.result;
            console.log("Order was persisted on database, entry: " + databaseEntry);


            /** 5. Send confirmation e-mail **/
            return ow.actions.invoke({
                actionName: params.ENVIRONMENT.sendConfirmationMailActionName,
                params: {item: params.order},
                // E-mail sending is not needed to be blocking
                // blocking: true
            });
        }
    });

    let finalTask = taskFive.then(confirmationMailResult => {
        if (branch == Branch.REGULAR_BRANCH) {
            console.log("Confirmation mail will be sent to : " + params.order.email);


            /** 6. Return confirmation response and publish some event to the consignment workflow Queue **/
            return {payload: `Order successful, ${params.order.id}!`};
        } else if (branch == Branch.PAYMENT_FAILED_BRANCH) {
            return {payload: `Order cancelled, because payment failed!`};
        }
    });

    finalTask.catch(err => {
        console.log("CATCH");
        console.log(err);
        return {payload: `Process workflow execution error, ${err}!`};
    });

    return finalTask;
}

function cancelOrder(order, ENVIRONMENT, err) {

    if (err == CancelCause.PAYMENT_FAILED) {
        /** 1.1 If no payment: send cancellation e-mail + return cancel response **/
        console.log(`Order cancelled, because payment failed!`);
        return ow.actions.invoke({
            actionName: ENVIRONMENT.sendCancelationMailActionName,
            params: {order: order, cause: err},
            // Mail is not needed to be blocking
            // blocking: true
        });

    } else if (err == CancelCause.INVENTORY_NOT_AVAILABE) {
        /** 2.1 If inventory error: send cancelation e-mail + return cancle response **/
        console.log(`Order cancelled, because item(s) not available!`);
        return ow.actions.invoke({
            actionName: ENVIRONMENT.sendCancelationMailActionName,
            params: {order: order, cause: err},
            // Mail is not needed to be blocking
            // blocking: true
        });
    }
}

function startInventoryProcess(order) {

    return new Promise((resolve, reject) => {
        const postData = JSON.stringify(order);
        const options = {
            hostname: 'y8xp771xgd.execute-api.us-east-1.amazonaws.com',
            path: '/dev/inventory-management/api/startOrderInventoryProcess',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const req = https.request(options, (res) => {
            let body;
            // console.log(`STATUS: ${res.statusCode}`);
            // console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
            res.setEncoding('utf8');
            res.on('data', (chunk) => {
                body = chunk;
            });
            res.on('end', () => {
                console.log('No more data in response.');
                console.log(`BODY: ${body}`);
                resolve(body);
            });
        });

        req.on('error', (err) => {
            console.log("Inventory process returned with error: " + err.message);
            // TODO this does not work: An error of the AWS Lambda is not handled and this action runs until it times out
            reject(err.message);
        });

        // write data to request body
        req.write(postData);
        req.end();
    });
}


exports.startOrderWorkflow = startOrderWorkflow;
