const sharp = require("sharp");
async function listMyObjects(bucket, prefix, isEdit = true) {
  try {
    const objects = await bucket.listPagedObjects({ prefix: prefix });
    let result = [];
    for (let i = 0; i < objects.contents.length; i++) {
      const objDetails = JSON.parse(objects.contents[i]);
      const imgInfo = {
        key: objDetails.key,
        object_url: objDetails.object_url,
        isEditAccess: isEdit
      };
      result.push(imgInfo);
    }
    return result;
  } catch (error) {
    console.error("Error at listMyObjects function: " + error);
  }
}
async function uploadToStratus(bucket, inputPath, thumbnailPath, thumbnailName) {
  try {
    const streamData = await sharp(inputPath)
      .resize({ width: 150, height: 150 })
      .toFormat("jpeg", { quality: 70 })
      .toBuffer();
    const result = await bucket.putObject(
      thumbnailPath + thumbnailName + ".jpeg",
      streamData
    );
    console.log("uploadToStratus method Completed");
    return result;
  } catch (error) {
    console.error("Error Occurred..." + JSON.stringify(error));
    throw { message: "Error in uploading", code: 500 };
  }
}
async function listSharedObjects(bucket, prefix, zcql, zuid) {
  try {
    let query = `SELECT * FROM ImageShareDetails WHERE UserZuid = ${zuid}`;
    let result = await zcql.executeZCQLQuery(query);
    const queryData = result.map(item => ({
      path: item.ImageShareDetails.BucketPath,
      isEdit: item.ImageShareDetails.IsUpdate
    }));
    let allSharedImages = [];
    for (const item of queryData) {
      const result = await listMyObjects(bucket, item.path, item.isEdit);
      allSharedImages.push(result);
    }
    return allSharedImages;
  } catch (error) {
    console.error("Error Occurred..." + error.message);
  }
}
module.exports = {
  listMyObjects,
  uploadToStratus,
  listSharedObjects
};