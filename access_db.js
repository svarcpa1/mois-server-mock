const fs = require("fs");

function getDataPayment() {
    let text = fs.readFileSync('./data/payment_data.json', 'utf8');
    let response = JSON.parse(text);
    return response;
}

function saveDataPayment(data) {
    fs.writeFileSync(
        "./data/payment_data.json",
        JSON.stringify(data, null, 2),
        "utf-8"
    );
}

function getDataUser() {
    let text = fs.readFileSync('./data/user_data.json', 'utf8');
    let response = JSON.parse(text);
    return response;
}

function saveDataUser(data) {
    fs.writeFileSync(
        "./data/user_data.json",
        JSON.stringify(data, null, 2),
        "utf-8"
    );
}

module.exports = {
    getDataPayment,
    saveDataPayment,
    getDataUser,
    saveDataUser
};