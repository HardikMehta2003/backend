const asyncHandler = (requesrHandler)=>{
    Promise.resolve(requesrHandler(req,res,next))
    .catch((err)=>next(err))
}


export {asyncHandler};








// const asyncHandler = (fn)=>async(res,req,next)=>{
//     try {
//         await fn(req,res,next)
//     } catch (error) {
//         res.status(err.code||500).json({
//             success:false,
//             messsge:err.messsge
//         })
//     }
// }