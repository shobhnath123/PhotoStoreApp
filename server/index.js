
'use strict';
const express = require('express');
const path = require('path');
let catalyst = require('zcatalyst-sdk-node');
const multer = require("multer");
const helperFunctions = require('./helper-function');
const app = express();
const appDir = path.join(__dirname, '../photo-store-app');
const port = process.env.X_ZOHO_CATALYST_LISTEN_PORT || 9000;
app.use(express.json());
app.use(express.static(appDir));
const upload = multer({ dest: "uploads/" });
app.get('/', function (req, res) {
  res.sendFile(path.join(appDir, 'index.html'));
});

app.post("/convertToThumbnailAndUpload", upload.single("image"), async (req, res) => {
  try {
    const obj = catalyst.initialize(req, { scope: 'admin' });
    const stratus = obj.stratus();
    const bucket = stratus.bucket("photostore14267");
    const thumbnailName = req.file.originalname.substring(0, req.file.originalname.lastIndexOf("."));
    const inputPath = req.file.path;
    const zuid = req.body.id;
    console.log("ID: " + zuid);
    const thumbnailPath = `photos/thumbnails/${zuid}/`;
    let result;
    await helperFunctions.uploadToStratus(bucket, inputPath, thumbnailPath, thumbnailName)
      .then(resp => {
        console.log("Success");
        result = resp;
        res.json({ message: "Thumbnail created and uploaded successfully" });
      })
      .catch(error => {
        console.error("Error: " + JSON.stringify(error.message));
        res.status(500).json({ message: "Error Occurred" });
        return;
      });
  } catch (error) {
    console.log("Error in convertToThumbnailAndUpload API: " + error.message);
  }
});
app.get("/fetchAllImages", async (req, res) => {
  try {
    const obj = catalyst.initialize(req);
    const zuid = req.query.id;
    console.log("ID: " + zuid);
    const objPath = "photos/" + zuid;
    const stratus = obj.stratus();
    const bucket = stratus.bucket("photostore14267");
    let resp = await helperFunctions.listMyObjects(bucket, objPath);
    res.json(resp);
  } catch (error) {
    console.error("Error at fetchAllImages API... ", error.message);
    res.status(500).send({ error: "An error occurred while fetching images." });
  }
});
app.get('/getAllUsers', async (req, res) => {
  try {
    const app = catalyst.initialize(req, { scope: "user" });
    const appAdmin = catalyst.initialize(req, { scope: "admin" });
    const userManagementAdmin = appAdmin.userManagement();
    const userManagements = app.userManagement();
    let allUserPromise = userManagementAdmin.getAllUsers();
    let currentUserPromise = userManagements.getCurrentUser();
    let details;
    let currentUser;
    await allUserPromise.then(allUserDetails => {
      details = allUserDetails;
    }).catch(err => {
      console.log("Error: " + err.message);
    });
    await currentUserPromise.then(details => {
      currentUser = details.email_id;
    }).catch(err => {
      console.log("Error: " + err.message);
    });
    const userDetails = details.map(id => ({
      zuid: id.zuid,
      mailId: id.email_id,
      name: id.first_name
    }));
    const otherUsers = userDetails.filter(user => user.mailId !== currentUser);
    res.send(otherUsers);
  } catch (error) {
    console.error("Error in getAllUsers API: " + JSON.stringify(error.message));
    res.status(500).send({ error: "An error occurred while fetching details." });
  }
});
app.post('/shareDetails', async (req, res) => {
  try {
    const app = catalyst.initialize(req);
    let zcql = app.zcql();
    let query = `SELECT COUNT(ImageShareDetails.BucketPath) FROM ImageShareDetails WHERE BucketPath = '${req.body.imagePath}' AND UserZuid = '${req.body.zuid}'`;
    let result = await zcql.executeZCQLQuery(query);
    let isPresent = result[0].ImageShareDetails["COUNT(BucketPath)"];
    if (isPresent == 0) {
      let rowData = {
        UserName: req.body.userName,
        BucketPath: req.body.imagePath,
        UserZuid: req.body.zuid,
        IsUpdate: req.body.isUpdate,
        SharedBy: req.body.sharedBy
      };
      let datastore = app.datastore();
      let table = datastore.table('ImageShareDetails');
      let insertPromise = table.insertRow(rowData);
      insertPromise.then((row) => {
        console.log("Inserted Row: " + row);
      }).catch((err) => {
        console.error("Error: " + err.message);
      });
      res.json({ message: "Access Provided" });
    } else {
      res.json({ message: "Image Already Shared" });
    }
  } catch (error) {
    console.error("Error in shareDetails API: " + error.message);
    res.status(500).send({ message: "Error Occurred" });
  }
});
app.get('/getSharedImages', async (req, res) => {
  try {
    const obj = catalyst.initialize(req);
    const zuid = req.query.id;
    const objPath = "photos/" + zuid;
    const stratus = obj.stratus();
    const bucket = stratus.bucket("photostore14267");
    const zcql = obj.zcql();
    let resp = await helperFunctions.listSharedObjects(bucket, objPath, zcql, zuid);
    res.json(resp);
  } catch (error) {
    console.error("Error in getSharedImages API: " + error.message);
    res.status(500).json({ message: "Error Occurred" });
  }
});
app.get('/getSharedDetails', async (req, res) => {
  try {
    const obj = catalyst.initialize(req);
    const zuid = req.query.id;
    let zcql = obj.zcql();
    let query = `SELECT * FROM ImageShareDetails WHERE SharedBy = '${zuid}'`;
    let data = await zcql.executeZCQLQuery(query);
    const result = data.map(item => ({
      UserName: item.ImageShareDetails.UserName,
      IsUpdate: item.ImageShareDetails.IsUpdate,
      BucketPath: item.ImageShareDetails.BucketPath,
      UserId: item.ImageShareDetails.UserZuid
    }));
    res.send(result);
  } catch (error) {
    console.error("Error in getSharedDetails API: " + error.message);
    res.status(500).json({ message: "Error Occurred" });
  }
});
app.patch('/updateSharedDetails', async (req, res) => {
  try {
    const obj = catalyst.initialize(req);
    const isRevoke = req.body.RevokeAccess;
    const zuid = req.body.UserId;
    const isUpdate = req.body.IsUpdate;
    const bucketPath = req.body.BucketPath;
    let zcql = obj.zcql();
    let query;
    if (isRevoke == "yes") {
      query = `DELETE FROM ImageShareDetails WHERE UserZuid = '${zuid}' AND BucketPath = '${bucketPath}'`;
    } else {
      query = `UPDATE ImageShareDetails SET IsUpdate = ${isUpdate} WHERE UserZuid = '${zuid}' AND BucketPath = '${bucketPath}'`;
    }
    let data = await zcql.executeZCQLQuery(query);
    res.json({ message: "Updated Successfully" });
  } catch (error) {
    console.error("Error in updateSharedDetails API: " + error);
    res.status(500).json({ message: "Error Occurred" });
  }
});
app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});

