const express = require("express");
const bodyParser = require('body-parser');
const path = require('path');
const fs = require("fs");

const app = express();
app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded
const port = process.env.PORT || 5000;

app.use(express.static(path.join(__dirname, 'build'), {maxAge: "30d"}));

app.use(function (req, res, next) {
  // Website you wish to allow to connect
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3000');
  // Request methods you wish to allow
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
  // Request headers you wish to allow
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');
  // Pass to next layer of middleware
  next();
});

var _ = require('lodash');

var moment = require('moment');

moment().format();

app.get('/', function(req, res) {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

//---payment call-------------------------------------------------------------------------------------------------------

app.get("/paymentList", (req, res) => {
  let response = getDataPayment();
  sendDelayedResponse(res, response, 1);
});

app.get('/paymentListByID/:id', (req, res) => {
  let response = getDataPayment();
  let id_url =parseInt(req.params.id);
  let filtered = _.filter(response, { 'id': id_url});
  sendDelayedResponse(res, filtered, 1);
});

app.get('/paymentListByDate/:from/:to/', (req, res) => {
  let response = getDataPayment();
  let from_url = req.params.from;
  let to_url = req.params.to;
  let dateFormat = "DD-MM-YYYY";
  let filtered = response.filter((o) => {
    return moment(o.dueDate, 'DD.MM.YYYY') // Convert to moment with exactly date format
        .isBetween(moment(from_url, dateFormat), moment(to_url, dateFormat));
  });
  sendDelayedResponse(res, filtered, 1);
});

app.get('/paymentListByAccountNumber/:accountNumber', (req, res) => {
  let response = getDataPayment();
  let accountNumber_url =req.params.accountNumber;
  let filtered = _.filter(response, {userAccount: {accountNumber_user: accountNumber_url}});
  sendDelayedResponse(res, filtered, 1);
});

app.get('/paymentListByCategoryID/:categoryId', (req, res) => {
  let response = getDataPayment();
  let idCategory_url = req.params.categoryId;
  let catString = idCategory_url.split("");
  let catInt = [];

  for (let i = 0; i<catString.length; i++) {
    catInt.push(parseInt(catString[i]));
  }

  let filtered = _.filter(response, (v) => _.indexOf(catInt, v.categoryId) !== -1);
  sendDelayedResponse(res, filtered, 1);
});

app.get('/paymentListByCategoryIDUser/:categoryId/:accountNumber', (req, res) => {
  let response = getDataPayment();
  let idCategory_url = req.params.categoryId;
  let accountNumber_url = req.params.accountNumber;
  let catString = idCategory_url.split("");
  let catInt = [];

  for (let i = 0; i<catString.length; i++) {
    catInt.push(parseInt(catString[i]));
  }

  let filtered = _.filter(response, (v) => _.indexOf(catInt, v.categoryId) !== -1);
  let filtered2 = _.filter(filtered, {userAccount: {accountNumber_user: accountNumber_url}});
  sendDelayedResponse(res, filtered2, 1);
});

app.post("/paymentItem", (req, res) => {
  let data = getDataPayment();
  let item = req.body;
  item.id = new Date().getTime();
  item.dueDate = Date.now();
  item.categoryId = calculateCategory(item.userAccount.accountNumber_user, item.partyAccount.accountNumber, 0);

  data.push(item);
  saveDataPayment(data);
  sendDelayedResponse(res, item, 1);
});

app.put("/paymentItem", (req, res) => {
  let newItem = req.body;
  let data = getDataPayment();
  let index = data.findIndex(item => item.id === newItem.id);
  data.splice(index, 1, newItem);
  saveDataPayment(data);
  sendDelayedResponse(res, newItem, 1);
});

app.delete("/paymentItem", (req, res) => {
  let newItem = req.body;
  let data = getDataPayment();
  let index = data.findIndex(item => item.id === newItem.id);
  data.splice(index, 1);
  saveDataPayment(data);
  sendDelayedResponse(res, newItem, 1);
});

//---user call----------------------------------------------------------------------------------------------------------

app.get("/userList", (req, res) => {
  let response = getDataUser();
  let filtered = _.filter(response, { 'active': true});
  sendDelayedResponse(res, filtered, 1);
});

app.get("/userByAccount/:accountNumber", (req, res) => {
  let response = getDataUser();
  let accountNumber_url = req.params.accountNumber;
  let filtered = _.filter(response, {userAccount: {number: accountNumber_url}});
  sendDelayedResponse(res, filtered, 1);
});

app.get("/userAuthenticate/:mail/:password/", (req, res) => {
  let response = getDataUser();
  let mail = req.params.mail;
  let password = req.params.password;
  let filtered = _.filter(response, { 'mail': mail, 'password': password});
  sendDelayedResponse(res, filtered, 1);
});

app.get("/userAuthenticateBool/:mail/:password", (req, res) => {
  let response = getDataUser();
  let mail = req.params.mail;
  let password = req.params.password;
  let filtered = _.filter(response, { 'mail': mail, 'password': password});
  if (isEmptyObject(filtered)) {
    filtered = false;
  } else {
    filtered = true;
  }
  sendDelayedResponse(res, filtered, 1);
});

app.post("/userItem", (req, res) => {
  let data = getDataUser();
  let item = req.body;
  item.id = new Date().getTime();
  data.push(item);
  saveDataUser(data);
  sendDelayedResponse(res, item, 1);
});

app.put("/userItem", (req, res) => {
  let newItem = req.body;
  let data = getDataUser();
  let index = data.findIndex(item => item.id === newItem.id);
  data.splice(index, 1, newItem);
  saveDataUser(data);
  sendDelayedResponse(res, newItem, 1);
});

app.delete("/userItem", (req, res) => {
  let newItem = req.body;
  let data = getDataUser();
  let index = data.findIndex(item => item.id === newItem.id);
  data.splice(index, 1);
  saveDataUser(data);
  sendDelayedResponse(res, newItem, 1);
});

//----------------------------------------------------------------------------------------------------------------------

function getDataPayment(){
  let text = fs.readFileSync('./data/payment_data.json','utf8');
  let response = JSON.parse(text);
  return response;
}

function saveDataPayment(data){
  fs.writeFileSync(
      "./data/payment_data.json",
      JSON.stringify(data, null, 2),
      "utf-8"
  );
}

function getDataUser(){
  let text = fs.readFileSync('./data/user_data.json','utf8');
  let response = JSON.parse(text);
  return response;
}

function saveDataUser(data){
  fs.writeFileSync(
      "./data/user_data.json",
      JSON.stringify(data, null, 2),
      "utf-8"
  );
}

//----------------------------------------------------------------------------------------------------------------------

function sendDelayedResponse(res, object, delay){
  setTimeout(function() {
    res.send(object);
  }, delay*10);
}

function isEmptyObject(obj) {
  for (var key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      return false;
    }
  }
  return true;
}


function calculateCategory(userAccount, partyAccount, mode) {
  let category;
  switch (mode) {
    case 0:
      let response = getDataPayment();
      let filtered = _.filter(response, {userAccount: {accountNumber_user: userAccount}});
      let filtered2 = _.filter(filtered, {partyAccount: {accountNumber: userAccount}});

      if (filtered2 === []) {
        category = 0;
        return category.toString();
      } else if (filtered2.length < 3) {
        category = 0;
        return category.toString();
      } else {
        let categoryArray = _.map(filtered2,'categoryId'); //create an array of tag values from the object array

        return mostCommon(categoryArray);
      }

      break;
    default:
      //code
  }
}

function mostCommon(array) {
  if(array.length == 0)
    return null;
  var modeMap = {};
  var maxEl = array[0], maxCount = 1;
  for(var i = 0; i < array.length; i++)
  {
    var el = array[i];
    if(modeMap[el] == null)
      modeMap[el] = 1;
    else
      modeMap[el]++;
    if(modeMap[el] > maxCount)
    {
      maxEl = el;
      maxCount = modeMap[el];
    }
  }
  return maxEl;
}

app.listen(port, () => console.log(`Listening on port ${port}`));