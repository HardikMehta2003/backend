import { asyncHandler } from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { User } from "../models/user.model.js";
import { uploadFileCloudinary } from "../utils/cloudinary.js";
// import { isPasswordCorrect } from "../models/user.model.js";


const generatAccessAndRefreshToken = async(userId)=>{
    try {
        const user = await User.findById(userId);
        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();
        user.refreshToken = refreshToken;
        user.save({validateBeforeSave:false});

        return {accessToken,refreshToken}

    } catch (error) {
        throw new ApiError(500)
    }
}


const registerUser = asyncHandler(async(req,res)=>{
     // get user details from frontend
     // validation - not empty
     // user already exist
     // check for avatar images
     // upload them to cloudinary,avatar
     // create user object-create entry in db
     // remove password and refresh token field from response
     // check for user creation
     // return response

    const {fullName,email,username,password} = req.body;
    console.log("email",email);

    // if(fullName === ""){
    //     throw new ApiError(400,"Fullname required");
    // }

    if(
        [fullName,email,username,password].some((field)=>
            field?.trim()==="")){
                throw new ApiError(400,"All Fields are required");
            };
        

    const existedUser = await User.findOne({
        $or: [{username},{email}]
    });
    console.log(existedUser);

    if(existedUser){
        throw new ApiError(409,"User Already existed");
    }

    console.log(req.files);
    const avatarLocalPath = req.files?.avatar[0]?.path;
    // const coverImageLocalPath = req.files?.coverImage[0]?.path;

    let coverImageLocalPath;
    if(req.files && Array.isArray(req.files.coverImage) && (req.files.coverImage.length > 0)){
        coverImageLocalPath = req.files?.coverImage[0]?.path;
    }

    if(!avatarLocalPath){
        throw new ApiError(400,"Avatar Required");
    }

    const avatar = await uploadFileCloudinary(avatarLocalPath);
    const coverImage = await uploadFileCloudinary(coverImageLocalPath);

    const user = await User.create({
        fullName,
        avatar:avatar.url,
        coverImage:coverImage?.url || "",
        email,
        password,
        username:username.toLowerCase(),
    });

    const userCreated = await User.findById(user._id).select(
        "-password -refreshToken"
    );

    if(!userCreated){
        throw new ApiError(500,"Something went Wrong while registering the User");
    }


    return res.status(201).json(
        new ApiResponse(200,userCreated,"User registered Succesfully")
    )

});


const loginUser = asyncHandler(async(req,res)=>{
    //req body ->data
    //username or email
    //find User
    //password check
    //generate refresh and access token
    //send cookie

    const {email,username,password} = req.body;

    if(!(username || email)){
        throw new ApiError(400,"username or email is Required");
    }

    const user = await User.findOne({
        $or : [{username},{email}]
    });

    if(!user){
        throw new ApiError(404,"User does not exist");
    }

    const isPasswordValid = await user.isPasswordCorrect(password);

    if(!isPasswordValid){
        throw new ApiError(401,"invalid user credentials");
    }

    const {accessToken,refreshToken} = await generatAccessAndRefreshToken(user._id);


    const loggedInUser = await User.findById(user._id).select("-password -refreshToken");

    const options ={
        httpOnly : true,
        secure : true,
    }

    return res
    .status(200)
    .cookie("accessToken",accessToken,options)
    .cookie("refreshToken",refreshToken,options)
    .json(
        new ApiResponse(200,{
            user:loggedInUser,accessToken,refreshToken,
        },"USER logged in succesfully")
    )
    
});


const logoutUser = asyncHandler(async(req,res)=>{
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set:{
                refreshToken:undefined,
            },
        },
        {
            new:true,
        }
    )

    const options ={
        httpOnly : true,
        secure : true,
    }

    return res
    .status(200)
    .clearCookie("accessToken",options)
    .clearCookie("refreshToken",options)
    .json(new ApiResponse(200,{},"User Logged Out"))

})


export {
    registerUser,
    loginUser,
    logoutUser
}