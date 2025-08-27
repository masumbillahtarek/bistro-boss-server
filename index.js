const express=require('express')
const cors=require('cors')


const app=express()
var jwt = require('jsonwebtoken');
require('dotenv').config()
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
const port=process.env.PORT||5000
app.use(cors())
app.use(express.json())




const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.m0h4513.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

   const database=client.db('BistroBoss')
   const menuCollection=database.collection('menu')
   const reviewsCollection=database.collection('reviews')
  const cartCollection=database.collection('cart')
    const userCollection=database.collection('users')
     const paymentsCollection=database.collection('payments')
//JWT related API
app.post('/jwt',async(req,res)=>{
  const user=req.body
  const token=jwt.sign(user,process.env.ACCESS_TOKEN_SECRET,{expiresIn:'1h'})
  res.send({token})
})

const verifyToken=(req,res,next)=>{
console.log('Inside Verify Token : ',req.headers.authorization)
if(!req.headers.authorization){
  res.status(401).send({message:'Unauthorized Access'})
}
const token=req.headers.authorization.split(' ')[1]
jwt.verify(token,process.env.ACCESS_TOKEN_SECRET,(err,decoded)=>{
  if(err){
      res.status(401).send({message:' Unauthorized Access'})
  }
  req.decoded=decoded
  next()
})
//next()
}
//Use Verify Admin After Verify Token

const verifyAdmin=async(req,res,next)=>{
  const email=req.decoded.email
  const query={email:email}
  const user=await userCollection.findOne(query)
  const isAdmin=user?.role==='admin'
  if(!isAdmin){
     return  res.status(403).send({message:'Forbidden Access'})
  }
  next()
}

// User Related Api
    app.get('/users',verifyToken,verifyAdmin,async(req,res)=>{
     // console.log(req.headers)
    const cursor=userCollection.find()
    const result=await cursor.toArray()
    res.send(result)
})

app.get('/users/admin/:email',verifyToken,async(req,res)=>{
const email=req.params.email
if(email !== req.decoded.email){
  return  res.status(403).send({message:'Forbidden Access'})
}
console.log('Current User Email :',req.params.email)
console.log('Admin Email :',req.decoded.email)
const query={email:email}
const user=await userCollection.findOne(query)
let admin=false
if(user){
  admin=user?.role==='admin'
}
res.send({admin})
})

app.post('/users',async(req,res)=>{
  const user=req.body;
  const query={email:user.email}
  const existingUser=await userCollection.findOne(query)
  if(existingUser){
    return res.send({message:'User Already Exists',insertedId:null})
  }
  const result=await userCollection.insertOne(user)
  res.send(result)
})

app.patch('/users/admin/:id',verifyToken,verifyAdmin,async(req,res)=>{
  const id=req.params.id;
  const filter={_id:new ObjectId(id)}
  const updateDoc={
    $set:{
      role:'admin'
    }
  }
  const result=await userCollection.updateOne(filter,updateDoc)
  res.send(result)
})
app.delete('/users/:id',verifyToken,verifyAdmin,async(req,res)=>{
const id=req.params.id;
const query={_id:new ObjectId(id)}
const result=await userCollection.deleteOne(query)
res.send(result)
})
//
app.get('/menu',async(req,res)=>{
    const cursor=menuCollection.find()
    const result=await cursor.toArray()
    res.send(result)
})
app.get('/menu/:id',async(req,res)=>{
  const id=req.params.id;
  const query={_id:new ObjectId(id)}
  const menu=await menuCollection.findOne(query)
  res.send(menu)
})
app.patch('/menu/:id',async(req,res)=>{
  const id=req.params.id;
  const query={_id:new ObjectId(id)}
  const menu=req.body;
  const updatedMenu={
    $set:{
        name:menu?.name,
    category: menu?.category,
    price:menu?.price,
    recipe:menu?.recipe,
    image:menu?.image
    }
  }
  const result=await menuCollection.updateOne(query,updatedMenu)
  res.send(result)
})
app.delete('/menu/:id',async(req,res)=>{
const id=req.params.id;
const query={_id:new ObjectId(id)}
const result=await menuCollection.deleteOne(query)
res.send(result)
})
app.post('/menu',verifyToken,verifyAdmin,async(req,res)=>{
  const cart=req.body;
  const result=await menuCollection.insertOne(cart)
  res.send(result)
})
app.get('/reviews',async(req,res)=>{
    const cursor=reviewsCollection.find()
    const result=await cursor.toArray()
    res.send(result)
})
//
app.post('/carts',async(req,res)=>{
  const cart=req.body;
  const result=await cartCollection.insertOne(cart)
  res.send(result)
})
app.get('/carts',async(req,res)=>{
 let query={}
 if(req.query?.email){
  query={email:req.query.email}
 }
 const result=await cartCollection.find(query).toArray()
 res.send(result)
})
app.delete('/carts/:id',async(req,res)=>{
const id=req.params.id;
const query={_id:new ObjectId(id)}
const result=await cartCollection.deleteOne(query)
res.send(result)
})

// Payment Intents
app.post('/create-payment-intent',async(req,res)=>{
  const {price}=req.body
  const amount=parseInt(price*100)
  const paymentIntent=await stripe.paymentIntents.create({
    amount:amount,
    currency:'usd',
   payment_method_types:['card']
  })
  res.send({
    clientSecret:paymentIntent.client_secret
  })
})

app.post('/payments',async(req,res)=>{
  const payment=req.body;
  const paymentResult=await paymentsCollection.insertOne(payment)

  console.log(payment)
  const query={_id:{
    $in:payment.cartIds.map(id=> new ObjectId(id))
  }}
  const result=await cartCollection.deleteMany(query)
  res.send({paymentResult,result})
})
app.get('/payments/:email',verifyToken,async(req,res)=>{
  const query={email:req.params.email}
  if(req.params.email!==req.decoded.email){
    return res.status(403).send({message:'Forbidden Access'})
  }
  const result=await paymentsCollection.find(query).toArray()
  res.send(result)
})
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
   // await client.close();
  }
}
run().catch(console.dir);


app.get('/',(req,res)=>{
    res.send('Bistro Boss Server Is Starting')
})

app.listen(port,()=>{
    console.log(`Bistro Boss is Starting From Port ${port}`)
})