const express = require("express");
const bodyParser = require('body-parser');
const path = require('path');
const fs = require("fs");

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
const port = process.env.PORT || 5000;

app.use(express.static(path.join(__dirname, 'build'), {maxAge: "30d"}));

app.use(function (req, res, next) {
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3000');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');
  next();
});

let _ = require('lodash');
let moment = require('moment');
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
  item.dueDate = moment();
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
  let filtered = _.filter(response, {userAccount: {accountNumber_user: accountNumber_url}});
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

//----------------------------------------------------------------------------------------------------------------------

function calculateCategory(userAccount, partyAccount, mode) {
  let category;
  let response = getDataPayment();

  //for party account
  let filtered = _.filter(response, {partyAccount: {accountNumber: userAccount}});
  //user account
  let filtered2 = _.filter(filtered, {userAccount: {accountNumber_user: userAccount}});

  switch (mode) {

    //most common
    case 0:
      if (filtered2 === []) {
        category = 0;
        return category.toString();
      } else if (filtered2.length <= 3) {
        let categoryArrayGlobal = _.map(filtered,'categoryId'); //create an array of tag values from the object array
        category = mostCommon(categoryArrayGlobal);
      } else {
        let categoryArrayUser = _.map(filtered2,'categoryId'); //create an array of tag values from the object array
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
  if(array.length === 0)
    return null;
  let modeMap = {};
  let maxEl = array[0], maxCount = 1;
  for(let i = 0; i < array.length; i++)
  {
    let el = array[i];
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