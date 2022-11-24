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

function removeDuplicate(arr2) {
    const seen = new Set();
    const arr1 = arr2.filter(el => {
        const duplicate = seen.has(el.category);
        seen.add(el.category);
        return !duplicate;
    });
    return arr1;
}

async function run() {
    try {
        const carCollection = client.db('your-car').collection('products');
        const paymentCollection = client.db('your-car').collection('payment');
        const userCollection = client.db('your-car').collection('users');
        const orderCollection = client.db('your-car').collection('order');
        const wishlistCollection = client.db('your-car').collection('wishlist');
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
        app.get('/my-products/:id', async (req, res) => {
            const query = { uid: req.params.id };
            const data = await carCollection.find(query).toArray();
            res.send(data);
        });
        app.get('/category', async (req, res) => {
            const data = await carCollection.find({}).toArray();
            const allCategory = removeDuplicate(data);
            res.send(allCategory);
        });
        app.get('/product/:category', async (req, res) => {
            const category = req.params.category;
            const query = { category: category };
            const products = await carCollection.find(query).toArray();
            res.send(products);
        })
        app.post('/order', async (req, res) => {
            const order = req.body;
            const result = await orderCollection.insertOne(order)
            res.send(result);
        });
        app.get('/my-orders/:id', async (req, res) => {
            const query = { uid: req.params.id };
            const data = await orderCollection.find(query).toArray();
            res.send(data);
        });
        app.post('/wishlist', async (req, res) => {
            const item = req.body;
            const query = { carId: item.carId }
            const data = await wishlistCollection.findOne(query);
            if (data) {
                const result = await wishlistCollection.deleteOne(item);
                res.send('Item removed from wishlist');
            }
            else {
                const result = await wishlistCollection.insertOne(item);
                res.send('Item added in wishlist');
            }
        });
        app.get('/wishlist/:id', async (req, res) => {
            const query = { uid: req.params.id };
            const data = await wishlistCollection.find(query).toArray();
            console.log(query)
            res.send(data);
        });



        // app.get('/services/pagination', async (req, res) => {
        //     const limit = parseInt(req.query.limit);
        //     const page = parseInt(req.query.page);
        //     const allData = await carCollection.find({}).toArray();
        //     const length = allData.length;
        //     const data = carCollection.find({}).skip(page * limit).limit(limit).sort({ _id: -1 });
        //     const services = await data.toArray();
        //     res.send({ services, length });
        // });
        // app.get('/search', async (req, res) => {
        //     const limit = parseInt(req.query.limit);
        //     const page = parseInt(req.query.page);
        //     const search = req.query.search;
        //     const query = { $or: [{ description1: { $regex: search, $options: 'i' } }, { title: { $regex: search, $options: 'i' } }] };
        //     const data = carCollection.find(query).skip(page * limit).limit(limit).sort({ _id: -1 });
        //     const dataForLength = await carCollection.find(query).toArray();
        //     const services = await data.toArray();
        //     const length = dataForLength.length;
        //     res.send({ services, length });
        // });



        // app.get('/review/:id', async (req, res) => {
        //     const id = req.params.id;
        //     const query = { serviceId: id }
        //     const result = await reviewCollection.find(query).sort({ time: -1 }).toArray();
        //     res.send(result);
        // });

        // app.get('/review/user/:id', jwtVerification, async (req, res) => {
        //     const decoded = req.decoded;
        //     const id = req.params.id;
        //     if (decoded.uid !== id) {
        //         return res.status(403).send({ message: 'Forbidden access !' })
        //     }
        //     const query = { user: id };
        //     const result = await reviewCollection.find(query).sort({ time: -1 }).toArray();
        //     res.send(result);
        // });

        // app.delete('/review/:id', async (req, res) => {
        //     const id = req.params.id;
        //     const query = { _id: ObjectId(id) }
        //     const result = await reviewCollection.deleteOne(query);
        //     res.send(result);
        // });

        // app.put('/review/:id', async (req, res) => {
        //     const id = req.params.id;
        //     const filter = { _id: ObjectId(id) };
        //     const { Reviewtitle, comment, rating, time } = req.body;
        //     const option = { upsert: false };
        //     const updatedUser = {
        //         $set: {
        //             Reviewtitle: Reviewtitle, comment: comment, rating: rating, time: time
        //         }
        //     }
        //     const result = await reviewCollection.updateOne(filter, updatedUser, option);
        //     res.send(result);
        // })

        app.post('/payment-intents', async (req, res) => {
            const price = parseFloat(req.body.price) * 100;
            if (price) {
                const paymentIntent = await stripe.paymentIntents.create({
                    amount: price,
                    currency: 'usd',
                    payment_method_types: ['card'],
                });
                res.send(paymentIntent);
            }
        })
        app.patch('/payment/:id', async (req, res) => {
            const id = req.params.id;
            const payment = req.body;
            const productFilter = { _id: ObjectId(id) };
            const orderFilter = { carId: id };
            const option = { upsert: false };
            const updatedProduct = {
                $set: {
                    sold: true
                }
            }
            const order = await orderCollection.findOne(orderFilter);
            const paymetData = {
                order,
                payment
            }
            const productResult = await carCollection.updateOne(productFilter, updatedProduct, option);
            const orderResult = await orderCollection.updateOne(orderFilter, updatedProduct, option);
            const wishlistResult = await wishlistCollection.deleteOne(orderFilter);
            const paymentResult = await paymentCollection.insertOne(paymetData);
            res.send(productResult);
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
            res.send(result);
        });
        app.get('/users', async (req, res) => {
            const role = req.query.role;
            const query = { role: role }
            const result = await userCollection.find(query).toArray();
            res.send(result);
        });
    } finally {

    }
}
run().catch(err => console.log(err));

app.listen(port, () => {
    console.log('node is running on ', port);
})



// { "_id": { "$oid": "637f7ed21d873ae6aef69d4e" }, "name": "Range Rover", "model": "GT-801", "milage": "50000", "date": "Nov 24, 2022", "year": "2015", "category": "suv", "sold": false, "add": false, "condition": "good", "marketPrice": "55000", "resalePrice": "40000", "image": "https://i.ibb.co/DQ8CfPq/rangerover.png", "location": "usa", "mobile": "0156203", "details": "The Rover Company (originator of the Land Rover marque) was experimenting with a larger model than the Land Rover Series in 1951, when the Rover P4-based two-wheel-drive \"Road Rover\" project was developed by Gordon Bashford.[2] This was shelved in 1958 and the idea lay dormant until 1966, when engineers Spen King and Bashford set to work on a new model.[3]", "uid": "84boNfNyDBYds1FFepO61Vh0B5A3", "sellerName": "seller1" }