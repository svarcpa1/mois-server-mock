const router = require('express').Router();
const db = require("./access_db");
const bcrypt = require('bcryptjs');
const _ = require('lodash');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
const fetch = require('node-fetch');

dotenv.config();

router.post('/hashPassword', (req, res) => {

    const salt = bcrypt.genSaltSync(10);
    const hashPassrowd = bcrypt.hashSync(req.body.password, salt);

    res.send(hashPassrowd);
});

router.post("/login", (req, res) => {
    let response = db.getDataUser();
    let mail = req.body.mail;
    let password = req.body.password;
    let users = _.filter(response, {'mail': mail});

    if (users.length < 1) {
        res.status(400).send('Email is not found!');
    } else {
        let user = users[0];
        if(!user.fbUser) {
            const validPass = bcrypt.compareSync(password, user.password);
            if (!validPass) {
                res.status(400).send('Invalid password!');
            } else {

                setNewToken(user, res);
                sendDelayedResponse(res, user, 1);
            }
        }
        else {
            res.status(400).send('Facebook User');
        }
    }
});

router.post("/fbLogin", (req, res) => {
    let fbRes = req.body;

    verifyFacebookToken(fbRes.accessToken).then(fbValid => {

        if (fbValid) {
            console.log(fbRes);

            let users = db.getDataUser();
            let user;

            let index = users.findIndex(item => item.id.toString() === fbRes.userID.toString());

            if (index < 0) {
                //NEW USER
                user = {
                    "id": parseInt(fbRes.userID),
                    "userAccount": {
                        "prefix_user": "035",
                        "accountNumber_user": Math.floor(Math.random() * 99999999999).toString(),
                        "bankCode_user": "2010"
                    },
                    "active": true,
                    "name": fbRes.name.split(' ')[0],
                    "sure_name": fbRes.name.split(' ')[1],
                    "mail": fbRes.email,
                    "password": null,
                    "prediction_mode": 0,
                    "fbUser": true,
                    "fbToken": fbRes.accessToken
                };

                users.push(user);
                db.saveDataUser(users);
                setNewToken(user, res);
                sendDelayedResponse(res, user, 1);
            } else {
                //USER EXIST
                user = users[index];
                if (user && user.active) {
                    user.fbToken = fbRes.accessToken;
                    users.splice(index, 1, user);
                    db.saveDataUser(users);
                    setNewToken(user, res);
                    sendDelayedResponse(res, user, 1);
                } else {
                    res.status(400).send('User is not active!');
                }
            }
        } else {
            res.status(400).send('Invalid Facebook Access Token!');
        }
    });
});

router.post("/loginBool", (req, res) => {
    let response = db.getDataUser();
    let mail = req.body.mail;
    let password = req.body.password;
    let users = _.filter(response, {'mail': mail});

    if (users.length < 1) {
        sendDelayedResponse(res, false, 1)
    } else {
        let user = users[0];
        const validPass = bcrypt.compareSync(password, user.password);

        sendDelayedResponse(res, validPass, 1);
    }
});

router.post("/currentUser", (req, res) => {
    getCurrentUser(req).then(user => {
        if (user) {
            sendDelayedResponse(res, user, 1);
        } else {
            res.status(400).send('User not found');
        }
    }).catch(e => {
        res.status(400).send(e.message);
    });
});

function setNewToken(user, res) {
    const expiration = process.env.DB_ENV === 'testing' ? 10000000000 : 604800000;
    const token = jwt.sign({_id: user.id}, process.env.TOKEN_SECRET);
    //res.header('auth-token', token);
    res.cookie('token', token, {
        expires: new Date(Date.now() + expiration),
        secure: false, // set to true if your using https
        httpOnly: false
    });
}

async function getCurrentUser(req) {
    if (req.cookies) {
        const token = req.cookies.token || '';
        if (token) {
            let response = db.getDataUser();
            let decoded;
            try {
                decoded = jwt.verify(token, process.env.TOKEN_SECRET);
            } catch (err) {
                throw Error("Invalid Token");
            }

            let users = _.filter(response, {'id': decoded._id});

            if (users.length < 1) {
                throw Error("User not found");
            } else {
                let user = users[0];

                if (user.fbUser) {
                    if (user.fbToken) {
                        let fbValid = await verifyFacebookToken(user.fbToken);
                        if (fbValid) {
                            return user;
                        } else {
                            throw Error("Invalid Facebook Access Token");
                        }
                    } else {
                        throw Error("Missing Facebook Token");
                    }
                } else {
                    return user;
                }
            }
        } else {
            throw Error("Missing Token");
        }
    } else {
        throw Error("Missing Token");
    }
}

function verifyToken(req, res, next) {
    //const token = req.header('auth-token');
    if (req.cookies) {
        const token = req.cookies.token || '';
        if (!token) return res.status(401).send('Access Denied');

        try {
            req.jwt = jwt.verify(token, process.env.TOKEN_SECRET);
            next();
        } catch (e) {
            res.status(400).send('Invalid Token');
        }
    } else {
        res.status(400).send('Missing Token');
    }
}

async function verifyFacebookToken(token) {
    try {
        //kontrola FB access token
        let response = await fetch('https://graph.facebook.com/debug_token?' +
            'input_token=' + token +
            '&access_token=' + process.env.FB_APP_ID + '|' + process.env.FB_APP_SECRET
        );

        let json = await response.json();

        return !!(response.ok && json.data.is_valid);
    } catch (e) {
        return false;
    }
}

function sendDelayedResponse(res, object, delay) {
    setTimeout(function () {
        res.send(object);
    }, delay * 10);
}

module.exports = {
    router,
    verifyToken,
    getCurrentUser
};