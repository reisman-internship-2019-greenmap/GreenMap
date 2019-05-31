require('dotenv').config();
const bc = require('barcodelookup');
const { models, connectDb } = require('../dal/database');
const { StatusCode } = require('../shared/constants');

const { insertProduct } = require('../utils/controller');

/**
 * Simple ping endpoint.
 * @param req request.
 * @param res response.
 */
let ping = (req, res) => {
    res.status(StatusCode.EASTER_EGG).send('Ping!');
};

/**
 * Simple welcome message for visitors to root url.
 * @param req request.
 * @param res response.
 */
let welcome = (req, res) => {
    res.status(StatusCode.EASTER_EGG).send('Welcome to the Greenmap-API!');
};

/**
 * Gets product from DAL - if not found it is retrieved from Barcodelookup and then stored in MongoDB.
 * @param req request.
 * @param res response.
 * @returns {Promise<void>} n/a.
 */
let getProduct = (req, res) => {
    connectDb().then(async () => {
        if (!req.params.id)
            return res.status(StatusCode.PRECONDITION_FAILED).send(null);
        // else
        let barcode = req.params.id;
        try {
            // search for product in MongoDB
            let doc = await models.Product.findOne({barcode});
            if (doc) {
                console.log(`found ${doc.barcode} in mongodb`);
                return res.status(StatusCode.OK).send({doc});
            }

            // else query barcodelookup for product
            let bclRes = await bc.lookup({key: process.env.BC_API_KEY, barcode: barcode});
            if (bclRes.statusCode !== StatusCode.OK) {
                console.error(`error looking up ${barcode} in barcodelookup`);
                return res.status(bclRes.statusCode).send({ data: bclRes.data });
            }

            if(!bclRes.data.manufacturer && !bclRes.data.brand) {
                console.error(`cannot find a manufacturer for ${barcode}`);
            }

            insertProduct(bclRes.data, barcode, res);

        } catch(err) {
            console.error(err);
            return res.status(StatusCode.BAD_REQUEST).send(err);
        }
    }).catch((err) => {
        console.error(err);
        return res.status(StatusCode.INTERNAL_SERVER_ERROR).send(err);
    });
};

/**
 * Adds a product to the Greenmap Database by value.
 * If only a barcode value is provided, the handler passes on the request to the addProductByLookup controller.
 * @param req request.
 * @param res response.
 * @param next to addProductByLookup.
 * @returns {Promise<void>} n/a.
 */
let addProductByValue = (req, res, next) => {
    connectDb().then(async () => {
        if (req.body.barcode && !req.body.name && !req.body.category && !req.body.manufacturer) {
            return next(); // to addProductByLookup
        }
        else if (!req.body.barcode && !req.body.name && !req.body.category && !req.body.manufacturer)
            return res.status(StatusCode.PRECONDITION_FAILED).send(null);
        // else
        let barcode = req.body.barcode;
        let doc = await models.Product.findOne({ barcode });
        if (doc) {
            console.error(`product ${req.body.barcode} already exists in database`);
            return res.status(StatusCode.CONFLICT).send({msg: `product ${doc.barcode} already exists in database`});
        }
        // else
        insertProduct(req.body, barcode, res);
    })
};

/**
 * Adds a product to the Greenmap Database using a Barcodelookup request.
 * @param req request.
 * @param res response.
 * @returns {Promise<void>} n/a.
 */
let addProductByLookup = async(req, res) => {
    connectDb().then(async () => {
        if (!req.body.barcode)
            return res.status(StatusCode.PRECONDITION_FAILED).send(null);
        // else
        let barcode = req.body.barcode;
        let doc = await models.Product.findOne({ barcode });
        if (doc) {
            console.error(`product ${req.body.barcode} already exists in database`);
            return res.status(StatusCode.CONFLICT).send({msg: `product ${req.body.barcode} already exists in database`});
        }
        // else
        // query barcodelookup for product
        let bclRes = await bc.lookup({key: process.env.BC_API_KEY, barcode: barcode});
        console.log(bclRes);
        if(bclRes.statusCode !== StatusCode.OK) {
            console.error(`error looking up ${barcode} in barcodelookup`);
            return res.status(bclRes.statusCode).send({ data: bclRes.data });
        }
        insertProduct(bclRes.data, barcode, res);
    });
};

module.exports =  {
    ping: ping,
    welcome: welcome,
    getProduct: getProduct,
    addProductByValue: addProductByValue,
    addProductByLookup: addProductByLookup
};