'use strict';

function hello(params) {
    // const name = params.name || 'World';
    let result = false;
    console.log(`Query external API and check payment success for order ID ${params.order.id}`);
    let randomNumber = Math.floor(Math.random() * 101);     // returns a number between 0 and 100
    //if (randomNumber < 80) result = true;
    if (randomNumber < 101) result = true;
    console.log("Payment success: " + result);

    return {paymentSuccess: result};
}

exports.hello = hello;
