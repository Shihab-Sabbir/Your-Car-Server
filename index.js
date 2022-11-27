const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const app = express();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

require('dotenv').config()


const port = process.env.PORT || 5000;
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
            const userId = req.decoded.uid;
            const query = { uid: userId };
            const user = await userCollection.findOne(query);
            if (user.role === 'admin') {
                 next();
            }
            else {
                return res.status(403).send({ message: 'Forbidden Access' });
            }
        }
        function removeDuplicate(arr2) {
            const seen = new Set();
            const arr1 = arr2.filter(el => {
                const duplicate = seen.has(el.category);
                seen.add(el.category);
                return !duplicate;
            });
            return arr1;
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
            const data = await carCollection.find({ sold: false }).toArray();
            const allCategory = removeDuplicate(data);
            res.send(allCategory);
        });
        app.get('/product/:category', async (req, res) => {
            const category = req.params.category;
            const query = { categoryId: category, sold: false };
            const products = await carCollection.find(query).toArray();
            console.log(query)
            res.send(products);
        })
        app.get('/single-product/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) }
            const product = await carCollection.findOne(query);
            res.send(product);
        })
        app.post('/advertise/:id', jwtVerification, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id), add: true }
            const query = { _id: ObjectId(id) }
            const add = await carCollection.findOne(filter);
            if (add) {
                const updateProduct = {
                    $set: {
                        add: false
                    }
                }
                const result = await carCollection.updateOne(query, updateProduct, { upsert: false });
                res.send('Remove from advertisement');
            }
            else {
                const updateProduct = {
                    $set: {
                        add: true
                    }
                }
                const result = await carCollection.updateOne(query, updateProduct, { upsert: false });
                res.send('Added to advertisement');
            }
        });
        app.get('/product/advertised/true', async (req, res) => {
            const query = { add: true, sold: false }
            const products = await carCollection.find(query).toArray();
            res.send(products);
        })
        app.post('/order', jwtVerification, async (req, res) => {
            const order = req.body;
            const query = { carId: order.carId, uid: order.uid }
            const alreadyBooked = await orderCollection.findOne(query);
            if (alreadyBooked) {
                return res.status(503).send('You have already book this item !');
            }
            else {
                const result = await orderCollection.insertOne(order)
                res.send(result);
            }
        });
        app.get('/my-orders/:id', jwtVerification, async (req, res) => {
            const query = { uid: req.params.id };
            const data = await orderCollection.find(query).toArray();
            res.send(data);
        });
        app.post('/wishlist', async (req, res) => {
            const item = req.body;
            const query = { carId: item.carId, uid: item.uid }
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
        app.delete('/wishlist/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) }
            const result = await wishlistCollection.deleteOne(query);
            res.send('Item removed from wishlist');
        });
        app.get('/wishlist/:id', async (req, res) => {
            const query = { uid: req.params.id };
            const data = await wishlistCollection.find(query).toArray();
            res.send(data);
        });
        app.post('/verify-seller/:id', jwtVerification, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const filter = { uid: id, verify: true }
            const query = { uid: id }
            const seller = await userCollection.findOne(filter);
            if (seller) {
                const updateSeller = {
                    $set: {
                        verify: false
                    }
                }
                const result = await userCollection.updateOne(query, updateSeller, { upsert: false });
                res.send('Verification Withdwar');
            }
            else {
                const updateSeller = {
                    $set: {
                        verify: true
                    }
                }
                const result = await userCollection.updateOne(query, updateSeller, { upsert: false });
                res.send('Seller is verified');
            }
        });
        app.delete('/delete-product/:id', jwtVerification, async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await carCollection.deleteOne(query);
            res.send(result);
        })
        app.delete('/delete-user/:id', jwtVerification, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await userCollection.updateOne(query, { $set: { hidden: "true" } })
            const userProduct = await carCollection.deleteMany({ uid: req.query.uid })
            const orderItemForSeller = await orderCollection.deleteMany({ sellerUid: req.query.uid, sold: false })
            const orderItemForBuyer = await orderCollection.deleteMany(query)
            res.send(result);
        })
        app.get('/search', async (req, res) => {
            const limit = parseInt(req.query.limit);
            const page = parseInt(req.query.page);
            const search = req.query.search;
            const query = { $or: [{ name: { $regex: search, $options: 'i' } }, { model: { $regex: search, $options: 'i' } }, { details: { $regex: search, $options: 'i' } }] };
            const data = carCollection.find(query).skip(page * limit).limit(limit);
            const dataForLength = await carCollection.find(query).toArray();
            const products = await data.toArray();
            const length = dataForLength.length;
            res.send({ products, length });
        });
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
        app.patch('/payment/:id', jwtVerification, async (req, res) => {
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
            const wishlistResult = await wishlistCollection.deleteOne(orderFilter);
            const paymentResult = await paymentCollection.insertOne(paymetData);
            if (order) {
                const orderResult = await orderCollection.updateOne(orderFilter, updatedProduct, { upsert: false });
            }
            else {
                const product = await carCollection.findOne(productFilter);
                const data = {
                    uid: payment.uid,
                    carId: product._id,
                    price: product.resalePrice,
                    productName: product.name,
                    image: product.image,
                    sold: true
                }
                const orderResult = await orderCollection.insertOne(data);
            }
            res.send(productResult);
        })
        app.post('/register', async (req, res) => {
            const user = req.body.user;
            const query = { uid: user.uid }
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
            const query = { role: role, hidden: { $not: { $regex: /^t.*/ } } } //hidden field does not start with t , means forst letter of t
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
