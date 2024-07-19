import { asyncHandler } from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { User } from "../models/user.model.js";
import { uploadFileCloudinary } from "../utils/cloudinary.js";
import fs from 'fs';
import jwt from "jsonwebtoken";


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


const refreshAccessToken = asyncHandler(async(req,res)=>{
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;

    if(!incomingRefreshToken){
        throw new ApiError(401,"unautherized request");
    }

    try {
        const decodedToken = jwt.verify(incomingRefreshToken,process.env.REFRESH_TOKEN_SECRET);

        const user = User.findById(decodedToken?._id);
    
        if(!user){
            throw new ApiError(401,"Invalid Refresh Token");
        }
    
        if(incomingRefreshToken !== user?.refreshToken){
            throw new ApiError(401,"Refresh Token Expired or Used");
        }
    
    
        const options = {
            httpOnly:true,
            secure:true
        }
    
        const {accessToken,newRefreshToken} =  await generatAccessAndRefreshToken(user._id);
    
        return res
        .status(200)
        .cookie("accessToken",accessToken,options)
        .cookie("refreshToken",newRefreshToken,options)
        .json(
            new ApiResponse(
                200,
                {accessToken,refreshToken:newRefreshToken},
                "Access token refreshed"
            )
        )
    } catch (error) {
        throw new ApiError(401,"Kuch gabad hai daya");
    }

})


const changeCurrentPassword = asyncHandler(async(req,res)=>{
    const {oldPassword,newPassword} = req.body;
    const user = await User.findById(user?._id);
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);

    if(!isPasswordCorrect){
        throw ApiError(400,"Invalid old Password");

    }

    user.password = newPassword;
    user.save({validationBeforeSave: false});

})


const getCurrentUser = asyncHandler(async(req,res)=>{
    return res
    .status(200)
    .json(200,req.user,"Current User fetched sucessfully");
})


const updateAccountDetails = asyncHandler(async(req,res)=>{
    const {fullName,email} = req.body;

    if(!(fullName || email)){
        throw new ApiError(400,"All fields are required");
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                fullName:fullName,
                email:email
            },
        },
        {
            new:true,
        }
    ).select("-password")

    return res
    .status(200)
    .json(new ApiResponse(200,user,"Account details updated successfully"))
})


const updateUserAvatar = asyncHandler(async(req,res)=>{
    const avatarLocalPath = req.file?.path;
    const deletePreviousAvatar = avatarLocalPath;
    if(!avatarLocalPath){
        throw new ApiError(400,"Avatar file is missing");
    }

    const avatar = await uploadFileCloudinary(avatarLocalPath);

    if(!avatar.url){
        throw new ApiError(400,"");
    }

    const user = User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                avatar:avatar.url
            }
        },
        {
            new:true, 
        }
    ).select("-password");

    try {
        fs.unlinkSync(deletePreviousAvatar);
      
        console.log("Delete File successfully.");
      } catch (error) {
        console.log(error);
      }
    return res
    .status(200)
    .json(new ApiResponse(200,user,"Avatar updated successfully"))

})

const updateCoverImage = asyncHandler(async(req,res)=>{
    const coverImageLocalPath = req.file?.path;

    if(!coverImageLocalPath){
        throw new ApiError(400,"CoverImage file Missing file is missing");
    }

    const coverImage = await uploadFileCloudinary(coverImageLocalPath);

    if(!coverImage.url){
        throw new ApiError(400,"");
    }

    const user = User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                coverImage:coverImage.url,
            }
        },
        {
            new:true,
        }
    ).select("-password");

    return res
    .status(200)
    .json(new ApiResponse(200,user,"Cover Image updated successfully"))

})

export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateCoverImage,
    changeCurrentPassword,
}