//const express = require('express')
//const fs = require('fs');
//const cors = require('cors')
//const path = require('path')
//const multer  = require('multer')
//require('dotenv').config()

import express from 'express'
import cors from 'cors'
import * as fs from 'fs'
import * as path from 'path'
import * as multer from 'multer'
import dotenv from 'dotenv'
import fetch from 'node-fetch'

const app = express()//.Router()

app.use(cors())
app.use(express.json())
app.use(express.urlencoded({extended:true}))
app.use(express.static('data'))


app.get('/categories',(req,res)=>{
    fs.readFile("data/categories.json", "utf8", (err, jsonString) => {
        res.setHeader("Access-Control-Allow-Origin","*")
        res.setHeader("Access-Control-Allow-Credentials","true")
        res.json(jsonString)
    })
})


//search functions
function editDistance(s1, s2) {
    s1 = s1.toLowerCase();
    s2 = s2.toLowerCase();
  
    var costs = new Array();
    for (let i = 0; i <= s1.length; i++) {
      var lastValue = i;
      for (let j = 0; j <= s2.length; j++) {
        if (i == 0)
          costs[j] = j;
        else {
          if (j > 0) {
            var newValue = costs[j - 1];
            if (s1.charAt(i - 1) != s2.charAt(j - 1))
              newValue = Math.min(Math.min(newValue, lastValue),
                costs[j]) + 1;
            costs[j - 1] = lastValue;
            lastValue = newValue;
          }
        }
      }
      if (i > 0)
        costs[s2.length] = lastValue;
    }
    return costs[s2.length];
  }
  function similarity(s1, s2) {
    var longer = s1;
    var shorter = s2;
    if (s1.length < s2.length) {
      longer = s2;
      shorter = s1;
    }
    var longerLength = longer.length;
    if (longerLength == 0) {
      return 1.0;
    }
    return (longerLength - editDistance(longer, shorter)) / parseFloat(longerLength);
  }
app.get('/refs',(req,res)=>{
    var refCat = req.query.category
    var searchQuery = req.query.search

    var pageNum = req.query.page
    var pageIndexStart = (pageNum-1)*5
    var pageIndexEnd = pageNum*5

    fs.readFile("data/refs.json", "utf8", (err, jsonString) => {
        var jsonObj = JSON.parse(jsonString)
        var queryRefs = []
        if (searchQuery==null&&refCat!=null) {
            for (let i=0;i<jsonObj.length;i++) {
                //category query
                if (jsonObj[i].category == refCat)
                    queryRefs.push(jsonObj[i])
            }
        }
        else if (refCat==null&&searchQuery!=null&&searchQuery!=null) {
            for (let i=0;i<jsonObj.length;i++) {
            //search query
                splitTile = jsonObj[i].title.toLowerCase().split(' ')
                titleSimilars = []
                for (let x=0;x<splitTile.length;x++) {
                    if (similarity(splitTile[x],searchQuery)>=0.7)
                        titleSimilars.push(2.5)
                    else {
                        titleSimilars.push(similarity(splitTile[x],searchQuery)+0.1)
                    }
                }
                if (jsonObj[i].description != '')
                    titleSimilars.push(similarity(jsonObj[i].description.toLowerCase(),searchQuery))
                
                if (similarity(jsonObj[i].title,searchQuery)>=0.6)
                    titleSimilars.push(similarity(jsonObj[i].title.toLowerCase(),searchQuery)+0.7)
                
                if (similarity(jsonObj[i].categoryPath.replace('/','').replace('/','').replace('/',''),searchQuery)>=0.3)
                    titleSimilars.push(similarity(jsonObj[i].categoryPath.toLowerCase(),searchQuery)+2)
                //gets avg similarity
                avgTotal = 0
                for (let y=0;y<titleSimilars.length;y++) {
                    avgTotal += titleSimilars[y]
                }
                avgSimilar = (avgTotal / titleSimilars.length)
                
                //add current ref to array if avg similarity is above threshold
                if (avgSimilar >= 0.625)
                    queryRefs.push(jsonObj[i])
            }
        }
        if (queryRefs.length > 5) {
            var origQueryRefsLength = queryRefs.length
            var queryRefs = queryRefs.slice(pageIndexStart,pageIndexEnd)
            
            //page nav logic
            if (((origQueryRefsLength-queryRefs.length) % 5) == 0)
                var finalPage = true
            else 
                var finalPage = false
        }   else {
            var finalPage = true
        }
        
        res.setHeader("Access-Control-Allow-Origin","*")
        res.setHeader("Access-Control-Allow-Credentials","true")
        res.json({"refs":queryRefs,"finalPage":finalPage})
    })
})

app.get('/refs/images',(req,res)=>{
    var refId = req.query.refId
    var fileExtension = 'png'

    //gets desired imgs file extension
    var imgs = fs.readdirSync("data/refs")
    for (i=0;i<imgs.length;i++) {
        if (parseInt(imgs[i].split('.')[0]) == parseInt(refId)) {
            var fileExtension = imgs[i].split('.')[1]
            break
        }
    }
    res.setHeader("Access-Control-Allow-Origin","*")
    res.setHeader("Access-Control-Allow-Credentials","true")
    res.sendFile(`data/refs/${refId}.${fileExtension}`)
})

app.get('/discordUser',async(req,res)=>{
    const token = process.env.TOKEN

    const fetchUser = async id => {
        const response = await fetch(`https://discord.com/api/v9/users/${id}`, {
            headers: {
            Authorization: `Bot ${token}`,
            cors: '*'
            }
        })
        if (!response.ok) throw new Error(`Error status code: ${response.status}`)
        return await response.json()
    }
    res.setHeader("Access-Control-Allow-Origin","*")
    res.setHeader("Access-Control-Allow-Credentials","true")
    res.json(await fetchUser(req.query.userId))
})

app.get('/authorityCheck',(req,res)=>{
    var authorityFor = req.query.type
    var userId = req.query.userId

    var authorisedList = fs.readFileSync(`data/${authorityFor}Ids.json`)
    for (let i=0;i<authorisedList.length;i++) {
        if (authorisedList[i] == userId) {
            res.setHeader("Access-Control-Allow-Origin","*")
            res.setHeader("Access-Control-Allow-Credentials","true")
            res.status('ok').send()
            break
        }
    }
    res.setHeader("Access-Control-Allow-Origin","*")
    res.setHeader("Access-Control-Allow-Credentials","true")
    res.status('err').send()
})

function createFileName() {
    //gets current ref count by counting files in data/refs
    var fileName = 1
    var fileName = fs.readdirSync('data/refs').length+1
    
    //sets multer things
    var storage = multer.diskStorage({
        destination: function (req, file, cb) {
            cb(null, 'data/refs/')
        },
        filename: function (req, file, cb) {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
            cb(null, fileName + path.extname(file.originalname))
        }
    })
    var upload = multer({storage: storage, limits: {fileSize:100000000}})    
}

app.post('/new-ref',(req,res,next)=>{
    createFileName()
    //get other form data from query
    var title = req.query.title
    var desc = req.query.desc
    var cat = req.query.cat
    var catPath = req.query.catPath
    var catPath = catPath.replace(/\s/g, "").replace(/>/g,'/')
    var catPath = catPath.toLowerCase()
    var userId = req.query.userId

    upload.single('image')(req, res, function (err) {
        if (err) {
            res.setHeader("Access-Control-Allow-Origin","*")
            res.setHeader("Access-Control-Allow-Credentials","true")
            res.json({msg: err.message})
        } else {
            const file = req.file
            // console.log(file)
            res.setHeader("Access-Control-Allow-Origin","*")
            res.setHeader("Access-Control-Allow-Credentials","true")
            res.json({msg: 'ok'})
            
            //append to refs.json
            var refsJsonFileContent = fs.readFileSync('data/refs.json')
            var refsJsonContent = JSON.parse(refsJsonFileContent)

            refsJsonContent.push({
                "refId": fs.readdirSync('data/refs').length,
                "category": cat,
                "categoryPath": catPath,
                "title": title,
                "description": desc,
                "commentCount": 0,
                "downloadCount": 0,
                "uploadedBy": userId,
                "comments": []
            })
            console.log(refsJsonContent)
            refsJsonFileContent = JSON.stringify(refsJsonContent)
            fs.writeFileSync('data/refs.json',refsJsonFileContent)
        }
    })
})


function getCommentId(refs) {
    var highestCommentId = 0
    for (let a=0;a<refs.length;a++) {
        if (refs[a].comments.length > 0) {
            for (let b=0;b<refs[a].comments.length;b++) {
                if (refs[a].comments[b].replies.length > 0) {
                    for (let c=0;c<refs[a].comments[b].replies.length;c++) {
                        if (refs[a].comments[b].replies[c].commentId > highestCommentId)
                            highestCommentId = refs[a].comments[b].replies[c].commentId
                    }
                }   else {
                    if (refs[a].comments[b].commentId > highestCommentId)
                        highestCommentId = refs[a].comments[b].commentId
                }
            }
        }
    }
    return highestCommentId
}

//comments
app.post('/add-comment',(req,res)=>{
    var type = req.query.type
    var toRef = req.query.toRef
    var comment = req.query.comment
    var commenter = req.query.userId

    var jsonStr = fs.readFileSync('data/refs.json')
    var jsonObj = JSON.parse(jsonStr)

    if (type=='comment') {
        for (let i=0;i<jsonObj.length;i++) {
            if (jsonObj[i].refId == toRef) {
                //commentId
                var commentId = getCommentId(jsonObj)
                
                jsonObj[i].comments.push({
                    "commentId": commentId,
                    "commentedBy": commenter,
                    "comment": comment,
                    "replies": []
                })
                jsonObj[i].commentCount = jsonObj[i].commentCount + 1
                fs.writeFileSync('data/commentId.txt',commentId)
                var jsonFile = JSON.stringify(jsonObj)
                fs.writeFileSync('data/refs.json',jsonFile)
                res.setHeader("Access-Control-Allow-Origin","*")
                res.setHeader("Access-Control-Allow-Credentials","true")
                res.json({'status':'ok'}).send()
                break
            }
        }
    }   else {
        for (let i=0;i<jsonObj.length;i++) {
            for (let x=0;x<jsonObj.comments.length;x++) {
                if (jsonObj[i].comments[x].commentId == toRef) {
                    //commentId
                    var commentId = getCommentId(jsonObj)
                    //console.log(commentId)

                    //append comment
                    jsonObj[i].comments[x].push({
                        "commentId": commentId,
                        "commentedBy": commenter,
                        "comment": comment,
                        "replies": []
                    })
                    jsonObj[i].commentCount = jsonObj[i].commentCount + 1
                    fs.writeFileSync('data/commentId.txt',commentId)
                    var jsonFile = JSON.stringify(jsonObj)
                    fs.writeFileSync('data/refs.json',jsonFile)
                    res.setHeader("Access-Control-Allow-Origin","*")
                    res.setHeader("Access-Control-Allow-Credentials","true")
                    res.json({'status':'ok'}).send()
                    break
                }
            }
        }
    }
})

app.get('/incDownloadCount',(req,res)=>{
    var ref = req.query.ref

    var jsonStr = fs.readFileSync('data/refs.json')
    var jsonObj = JSON.parse(jsonStr)
    
    for (let i=0;i<jsonObj.length;i++) {
        if (jsonObj[i].refId == ref) {
            jsonObj[i].downloadCount += 1
            break
        }
    }

    var jsonFile = JSON.stringify(jsonObj)
    fs.writeFileSync('data/refs.json',jsonFile)
    res.setHeader("Access-Control-Allow-Origin","*")
    res.setHeader("Access-Control-Allow-Credentials","true")
})

app.listen(3001, ()=>{
    console.log('Listening on port 3001')
})
// app.use('/.netlify/functions/api',app)
// module.exports.handler = serverless(app)
