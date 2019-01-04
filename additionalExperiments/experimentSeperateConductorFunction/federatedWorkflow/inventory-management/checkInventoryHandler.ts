import {APIGatewayEvent, Callback, Context, Handler} from 'aws-lambda';

export const checkInventory: Handler = (event: APIGatewayEvent, context: Context, cb: Callback) => {

    let items = [];
    if (!(<any> event).items) {
        return {error: "No items"}
    } else {
        items = (<any> event).items;
    }

    for (let i in items) {
        let randomNumber = Math.floor(Math.random() * 101);     // returns a number between 0 and 100
        items[i].available = (randomNumber < 90);
    }

    const response = {
        statusCode: 200,
        body: JSON.stringify({
            message: 'Inventory checked!',
            items: items
        })
    };

    cb(null, response);
};