const router = require('express').Router();
const db = require("./access_db");
const bcrypt = require('bcryptjs');
const _ = require('lodash');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');

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
        const validPass = bcrypt.compareSync(password, user.password);
        if (!validPass) {
            res.status(400).send('Invalid password!');
        } else {

            const expiration = process.env.DB_ENV === 'testing' ? 10000000000 : 604800000;
            const token = jwt.sign({_id: user.id}, process.env.TOKEN_SECRET);
            //res.header('auth-token', token);
            res.cookie('token', token, {
                expires: new Date(Date.now() + expiration),
                secure: false, // set to true if your using https
                httpOnly: false
            });

            sendDelayedResponse(res, user, 1);
        }
    }
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
    try {
        let user = getCurrentUser(req);
        sendDelayedResponse(res, user, 1);
    }
    catch (e) {
        res.status(400).send(e.message);
    }
});

function getCurrentUser(req) {
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
                return users[0];
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
            req.user = jwt.verify(token, process.env.TOKEN_SECRET);
            next();
        } catch (e) {
            res.status(400).send('Invalid Token');
        }
    } else {
        res.status(400).send('Missing Token');
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