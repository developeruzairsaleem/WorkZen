const knex = require('../../config/dbConfig')
const bcrypt = require("bcrypt");
const {validateUser} = require('../../utils/validationUtils')
const {createResponseObjectRegister, saveTokensInResponseObj, createResponseObjectLogin} = require('../../utils/responseUtils')
const{savePasswordHashToDB,saveUserRoleToDB,saveUserToDB, isUserRegistered, isPasswordCorrect, getUserRole, getUser} = require('../../services/authService')
const {generateRefreshToken,generateAccessToken,storeRefreshToken} = require('../../services/jwtService')

//       ---------------auth schema------------
//users          ----id-----username-------email-------
//userrole       ----id-----role-----------email-------
//login          ----id-----hash-----------email----------


//       --------------tasks schema ---------------
//tasks          ----id-----email----------status--------title--------description----projectid-----asssigned



const authController = {


 


/*------------------------------------------------------------------------*/
/*--------------------------Register Controller---------------------------*/
/*------------------------------------------------------------------------*/
  async register(req, res){
    const { username, email, password } = req.body;

    // validating user
    const isValid = validateUser(username, email, password);
    if (!isValid) {
      // if credentials are not valid sending invalid response
      return res.status(400).json({error:"invalid"});
    }
      try {

          // if the credentials are valid creating a transaction for storing data
          const response =  await knex.transaction(async(trx) => {

          // save user data into postgres 
            const userData = await saveUserToDB(username,email,trx);

          // save user role into postgres 
            const userRole = await saveUserRoleToDB(email,trx);

          // save user hash into login table in database  
            const userHash = await savePasswordHashToDB(email,password,trx);
 
            // create a response object containing all the values returned from above db interaction
            const responseObj = createResponseObjectRegister(userData,userRole,userHash)
           
            // generate access token 
            const accessToken = generateAccessToken(responseObj.id,responseObj.role);

            // generate refresh token to get new access token when it expires
           const refreshToken = generateRefreshToken(responseObj.id,responseObj.role);

           // store refresh token in db
           await storeRefreshToken(refreshToken,responseObj.id,trx);

           //save tokens in response obj
           const responseObjForUser = saveTokensInResponseObj(responseObj,accessToken,refreshToken)

            // commit the transaction and return the response OBJ if everything is saved to db
            return responseObjForUser;
         })

          // after the successful transaction sending the response to the client with 'success'
          return  res.status(201).json(response)
        }
      catch (error) {

          // if any error occured during transaction respond with 400 error
          console.log(error)
          return  res.status(400).json({error:'user not created'});
      }
  },










// //  login controller
//   login(req, res, next) {

//     const {email, password } = req.body;
//     const response ={};


//     // validating user
//     const isValid = authController.validateUser("DEFAULT", email, password);
//     if(!isValid){
//       return res.status(400).json({ error:"invalid"});
//     }


//     // Retrieving user data from the database
//       knex.select("*").from("login").where({email}).first()
//       .then(user=>{
//         if(!user){
//           throw new Error("User not found!")
//         }
//         // Comparing passwords
//         return bcrypt.compare(password, user.hash);
//       })

//       //handling the password match
//       .then(passwordMatch=>{
//         if(!passwordMatch){
//          throw new Error('password did not match');
//         }
//         return knex.select('*').from('users').where({email}).first()
//       })

//       //handling the user data
//       .then(user=>{
//         response.username= user.username;
//         response.email= user.email;
//         response.id = user.id;
//         return knex.select("*").from('userrole').where({email}).first()
//       })

//       //handling the role data
//       .then(userRole=>{
//         response.role= userRole.role;
//         return res.status(200).json(response)
//       })
//       .catch((err)=> {
//         console.log(err)
//         res.status(400).json({error:"invalid credentials"})})


//   },








 async login(req,res,next){

    const {email, password} = req.body;

    // validating user
    const isValid = validateUser("DEFAULT", email, password);
    if(!isValid){
      return res.status(400).json({error:"invalid"})
    }
    try{

      // check if the user is registered in db
      const userLogin = await isUserRegistered(email);
      if(!userLogin){
        return res.status(400).json({error:"invalid credentials"});
      }

      // check if the password matches with the hash
      const match = await isPasswordCorrect(password, userLogin.hash)
      if(!match) {
       return res.status(400).json({error:"invalid credentials"})
      }

      // get user data from db
     const user = await getUser(email)
     const userRole = await getUserRole(email)

      //generate tokens and update them to db
     const refreshToken = generateRefreshToken(user.id,userRole.role)
     const accessToken = generateAccessToken(user.id,userRole.role)
     await storeRefreshToken(refreshToken,user.id,knex)
    
     // create response object from user data
     const response = createResponseObjectLogin(user,userRole,accessToken,refreshToken)

      return res.status(200).json(response)
    }
    catch(error){
      return res.status(400).json({error:"unable to login"})
    }


  }
,


  logout(req, res, next) {},
};

module.exports = authController;