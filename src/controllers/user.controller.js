import { asyncHandler } from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { User } from "../models/user.model.js";
import { uploadFileCloudinary } from "../utils/cloudinary.js";
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

export {
    registerUser,
}