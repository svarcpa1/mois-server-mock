const express = require("express");
const bodyParser = require('body-parser');
//const cors = require('cors');
const path = require('path');
const db = require('./access_db');
const auth = require('./auth');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');

let _ = require('lodash');
let moment = require('moment');
moment().format();

const port = process.env.PORT || 5000;

const app = express();
//app.use(cors({origin: 'http://localhost:3000', credentials: true}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));


app.use(express.static(path.join(__dirname, 'build'), {maxAge: "30d"}));

app.use(function (req, res, next) {
    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3000');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    next();
});

app.use(cookieParser());

//Route Middlewares
app.use('/auth', auth.router);

app.get('/', function (req, res) {
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

//---payment call-------------------------------------------------------------------------------------------------------

app.get("/paymentList", (req, res) => {
    let response = db.getDataPayment();
    sendDelayedResponse(res, response, 1);
});
app.get('/paymentListByID/:id', (req, res) => {
    let response = db.getDataPayment();
    let id_url = req.params.id;
    let filtered = _.filter(response, {'id': id_url});
    sendDelayedResponse(res, filtered, 1);
});
app.get('/paymentListByDate/:from/:to/', (req, res) => {
    let response = db.getDataPayment();
    let from_url = req.params.from;
    let to_url = req.params.to;
    let dateFormat = "DD.MM.YYYY";
    let filtered = response.filter((o) => {
        return moment(o.dueDate, 'DD.MM.YYYY') // Convert to moment with exactly date format
            .isBetween(moment(from_url, dateFormat), moment(to_url, dateFormat));
    });
    sendDelayedResponse(res, filtered, 1);
});
app.get('/paymentListByDateUser/:from/:to/:accountNumber', (req, res) => {
    let response = db.getDataPayment();
    let from_url = req.params.from;
    let to_url = req.params.to;
    let accountNumber_url = parseInt(req.params.accountNumber);
    let dateFormat = "YYYY-MM-DD";
    let filteredAccountNumber = _.filter(response, {userAccount: {accountNumber_user: accountNumber_url}});
    let filtered = filteredAccountNumber.filter((o) => {
        return moment(o.dueDate, 'DD.MM.YYYY') // Convert to moment with exactly date format
            .isBetween(moment(from_url, dateFormat), moment(to_url, dateFormat));
    });
    sendDelayedResponse(res, filtered, 1);
});
app.get('/paymentListByDateUserCategory/:from/:to/:accountNumber/:categoryID', (req, res) => {
    let response = db.getDataPayment();
    let from_url = req.params.from;
    let to_url = req.params.to;
    let accountNumber_url = parseInt(req.params.accountNumber);
    let idCategory_url = req.params.categoryID;
    let dateFormat = "YYYY-MM-DD";

    let catString = idCategory_url.split("");
    let catInt = [];

    for (let i = 0; i < catString.length; i++) {
        catInt.push(parseInt(catString[i]));
    }

    let filteredByCategory = _.filter(response, (v) => _.indexOf(catInt, v.categoryId) !== -1);
    let filteredAccountNumber = _.filter(filteredByCategory, {userAccount: {accountNumber_user: accountNumber_url}});
    let filtered = filteredAccountNumber.filter((o) => {
        return moment(o.dueDate, 'DD.MM.YYYY') // Convert to moment with exactly date format
            .isBetween(moment(from_url, dateFormat), moment(to_url, dateFormat));
    });
    sendDelayedResponse(res, filtered, 1);
});
app.get('/paymentListByAccountNumber/:accountNumber', auth.verifyToken, (req, res) => {
    let response = db.getDataPayment();
    let accountNumber_url = parseInt(req.params.accountNumber);
    let filtered = _.filter(response, {userAccount: {accountNumber_user: accountNumber_url}});
    sendDelayedResponse(res, filtered, 1);
});
app.get('/paymentListByCategoryID/:categoryId', (req, res) => {
    let response = db.getDataPayment();
    let idCategory_url = req.params.categoryId;
    let catString = idCategory_url.split("");
    let catInt = [];

    for (let i = 0; i < catString.length; i++) {
        catInt.push(parseInt(catString[i]));
    }

    let filtered = _.filter(response, (v) => _.indexOf(catInt, v.categoryId) !== -1);
    sendDelayedResponse(res, filtered, 1);
});
app.get('/paymentListByCategoryIDUser/:categoryId/:accountNumber', auth.verifyToken, (req, res) => {
    let response = db.getDataPayment();
    let idCategory_url = req.params.categoryId;
    let accountNumber_url = parseInt(req.params.accountNumber);
    let catString = idCategory_url.split("");
    let catInt = [];

    for (let i = 0; i < catString.length; i++) {
        catInt.push(parseInt(catString[i]));
    }

    let filtered = _.filter(response, (v) => _.indexOf(catInt, v.categoryId) !== -1);
    let filtered2 = _.filter(filtered, {userAccount: {accountNumber_user: accountNumber_url}});
    sendDelayedResponse(res, filtered2, 1);
});
app.post("/paymentItem", auth.verifyToken, (req, res) => {
    let data = db.getDataPayment();
    let item = req.body;
    item.id = new Date().getTime();
    item.dueDate = moment().format("DD.MM.YYYY");
    item.categoryId = calculateCategory(item.userAccount.accountNumber_user, item.partyAccount.accountNumber, 0);

    data.push(item);
    db.saveDataPayment(data);
    sendDelayedResponse(res, item, 1);
});
app.put("/paymentItem", auth.verifyToken, (req, res) => {
    let newItem = req.body;
    let data = db.getDataPayment();
    let index = data.findIndex(item => item.id === newItem.id);
    data.splice(index, 1, newItem);
    db.saveDataPayment(data);
    sendDelayedResponse(res, newItem, 1);
});
app.delete("/paymentItem", auth.verifyToken, (req, res) => {
    let newItem = req.body;
    let data = db.getDataPayment();
    let index = data.findIndex(item => item.id === newItem.id);
    data.splice(index, 1);
    db.saveDataPayment(data);
    sendDelayedResponse(res, newItem, 1);
});

//---user call----------------------------------------------------------------------------------------------------------

app.get("/userList", auth.verifyToken, (req, res) => {
    let response = db.getDataUser();
    let filtered = _.filter(response, {'active': true});
    sendDelayedResponse(res, filtered, 1);
});
app.get("/userByAccount/:accountNumber", auth.verifyToken, (req, res) => {
    let response = db.getDataUser();
    let accountNumber_url = req.params.accountNumber;
    let filtered = _.filter(response, {userAccount: {accountNumber_user: accountNumber_url}});
    sendDelayedResponse(res, filtered, 1);
});
app.post("/userItem", auth.verifyToken, (req, res) => {
    let data = db.getDataUser();
    let item = req.body;
    item.id = new Date().getTime();
    data.push(item);
    db.saveDataUser(data);
    sendDelayedResponse(res, item, 1);
});
app.put("/userItem", (req, res) => {
    let newItem = req.body;

    //hash password
    const salt = bcrypt.genSaltSync(10);
    newItem.password = bcrypt.hashSync(newItem.password, salt);

    let data = db.getDataUser();
    let index = data.findIndex(item => item.id === newItem.id);
    index = index > -1 ? index : data.length;
    data.splice(index, 0, newItem);
    db.saveDataUser(data);
    sendDelayedResponse(res, newItem, 1);
});
app.delete("/userItem", auth.verifyToken, (req, res) => {
    let newItem = req.body;
    let data = db.getDataUser();
    let index = data.findIndex(item => item.id === newItem.id);
    data.splice(index, 1);
    db.saveDataUser(data);
    sendDelayedResponse(res, newItem, 1);
});

//----------------------------------------------------------------------------------------------------------------------

function sendDelayedResponse(res, object, delay) {
    setTimeout(function () {
        res.send(object);
    }, delay * 10);
}

function isEmptyObject(obj) {
    for (var key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            return false;
        }
    }
    return true;
}

//----------------------------------------------------------------------------------------------------------------------

function calculateCategory(userAccount, partyAccount, mode) {
    let category = 0;
    let response = db.getDataPayment();

    //for party account
    let filtered = _.filter(response, {partyAccount: {accountNumber: partyAccount}});
    //user account
    let filtered2 = _.filter(filtered, {userAccount: {accountNumber_user: userAccount}});
    switch (mode) {
        //most common
        case 0:
            if (filtered2.length===0) {
                category = 0;
            } else if (filtered2.length <= 3 && filtered2.length>0) {
                let categoryArrayGlobal = _.map(filtered, 'categoryId'); //create an array of tag values from the object array
                category = mostCommon(categoryArrayGlobal);
            } else {
                let categoryArrayUser = _.map(filtered2, 'categoryId'); //create an array of tag values from the object array
                category = mostCommon(categoryArrayUser);
            }
            return category;
        //last
        case 1:
            let ordered = _.orderBy(filtered2, ['dueDate'], ['desc']);
            let headOrdered = _.head(ordered);

            if (headOrdered.length > 0) {
                category = headOrdered[0].categoryId;
            } else {
                category = 0;
            }

            return category;

        default:
            return 0;
    }
}

function mostCommon(array) {
    if (array.length === 0)
        return null;
    let modeMap = {};
    let maxEl = array[0], maxCount = 1;
    for (let i = 0; i < array.length; i++) {
        let el = array[i];
        if (modeMap[el] == null)
            modeMap[el] = 1;
        else
            modeMap[el]++;
        if (modeMap[el] > maxCount) {
            maxEl = el;
            maxCount = modeMap[el];
        }
    }
    return maxEl;
}

app.listen(port, () => console.log(`Listening on port ${port}`));