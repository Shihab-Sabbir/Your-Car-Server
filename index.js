const express = require('express');
const cors = require('cors');
const app = express();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const port = process.env.PORT || 5000;
const jwt = require('jsonwebtoken');
require('dotenv').config()
const stripe = require('stripe')(process.env.STRIPE_SECRET);


app.use(cors());
app.use(express.json());


app.get('/', (req, res) => {
    res.send('hello world');
})



const uri = `mongodb+srv://${process.env.MONGO_USER}:${process.env.MONGO_PASS}@testing.wbduv4j.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });


async function run() {
    try {
        const carCollection = client.db('your-car').collection('products');
        const reviewCollection = client.db('your-car').collection('review');
        const userCollection = client.db('your-car').collection('users');
        console.log('mongo db connect');

        function jwtVerification(req, res, next) {
            const authHeaders = req.headers.authorization;
            if (!authHeaders) {
                return res.status(401).send({ message: 'unauthorized access !' })
            }
            const token = authHeaders.split(' ')[1];
            jwt.verify(token, process.env.SECRET, function (err, decoded) {
                if (err) {
                    return res.status(403).send({ message: 'Forbidden access !' })
                }
                else {
                    req.decoded = decoded;
                    next();
                }
            });
        }
        async function verifyAdmin(req, res, next) {
            const userId = req.params.uid;
            const query = { uid: userId };
            const user = await userCollection.findOne(query);
            if (user.role === 'admin') {
                res.status(200).send('Valid Admin');
                return next();
            }
            else {
                return res.status(403).send('Forbidden Access');
            }
        }

        app.post('/jwt', (req, res) => {
            const data = req.body;
            const token = jwt.sign(data, process.env.SECRET, { expiresIn: '1h' });
            res.send({ token });
        });


        app.post('/add-product', async (req, res) => {
            const product = req.body;
            const result = await carCollection.insertOne(product);
            res.send(result);
        })
        app.get('/services', async (req, res) => {
            const query = parseInt(req.query.limit);
            const data = carCollection.find({}).limit(query).sort({ _id: -1 });
            const services = await data.toArray();
            res.send(services);
        });
        app.get('/services/pagination', async (req, res) => {
            const limit = parseInt(req.query.limit);
            const page = parseInt(req.query.page);
            const allData = await carCollection.find({}).toArray();
            const length = allData.length;
            const data = carCollection.find({}).skip(page * limit).limit(limit).sort({ _id: -1 });
            const services = await data.toArray();
            res.send({ services, length });
        });
        app.get('/search', async (req, res) => {
            const limit = parseInt(req.query.limit);
            const page = parseInt(req.query.page);
            const search = req.query.search;
            const query = { $or: [{ description1: { $regex: search, $options: 'i' } }, { title: { $regex: search, $options: 'i' } }] };
            const data = carCollection.find(query).skip(page * limit).limit(limit).sort({ _id: -1 });
            const dataForLength = await carCollection.find(query).toArray();
            const services = await data.toArray();
            const length = dataForLength.length;
            res.send({ services, length });
        });

        app.get('/services/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const service = await carCollection.findOne(query);
            res.send(service);
        })

        app.post('/review', async (req, res) => {
            const review = req.body;
            const result = await reviewCollection.insertOne(review)
            res.send(result);
        });

        app.get('/review/:id', async (req, res) => {
            const id = req.params.id;
            const query = { serviceId: id }
            const result = await reviewCollection.find(query).sort({ time: -1 }).toArray();
            res.send(result);
        });

        app.get('/review/user/:id', jwtVerification, async (req, res) => {
            const decoded = req.decoded;
            const id = req.params.id;
            if (decoded.uid !== id) {
                return res.status(403).send({ message: 'Forbidden access !' })
            }
            const query = { user: id };
            const result = await reviewCollection.find(query).sort({ time: -1 }).toArray();
            res.send(result);
        });

        app.delete('/review/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) }
            const result = await reviewCollection.deleteOne(query);
            res.send(result);
        });

        app.put('/review/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const { Reviewtitle, comment, rating, time } = req.body;
            const option = { upsert: false };
            const updatedUser = {
                $set: {
                    Reviewtitle: Reviewtitle, comment: comment, rating: rating, time: time
                }
            }
            const result = await reviewCollection.updateOne(filter, updatedUser, option);
            res.send(result);
        })

        app.post('/payment-intents', async (req, res) => {
            const price = parseFloat(req.body.price) * 100;
            const paymentIntent = await stripe.paymentIntents.create({
                amount: price,
                currency: 'usd',
                payment_method_types: ['card'],
            });
            res.send(paymentIntent);
        })
        app.post('/payment', async (req, res) => {

            res.send();
        })
        app.post('/login', async (req, res) => {
            const user = req.body?.user;
            console.log(user)
            const query = { uid: user?.uid }
            const isExist = await userCollection.findOne(query);
            if (isExist) {
                return res.send('user already exists');
            }
            else {
                const result = await userCollection.insertOne(user);
                res.send(result);
            }
        })
        app.get('/user/:id', async (req, res) => {
            const id = req.params.id;
            const query = { uid: id }
            const result = await userCollection.findOne(query);
            console.log(result)
            res.send(result);
        });
    } finally {

    }
}
run().catch(err => console.log(err));

app.listen(port, () => {
    console.log('node is running on ', port);
})
