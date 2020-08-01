//jshint esversion:6
require('dotenv').config();
const express = require("express");
const bodyparser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const session = require('express-session');
const passport = require("passport");
const flash = require("connect-flash");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const findOrCreate = require('mongoose-findorcreate');

const app = express();


app.use(express.static("public"));
app.set('view engine', 'ejs');
app.use(bodyparser.urlencoded({
  extended: true
}));

app.use(session({
  secret: "Our little secret.",
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());
app.use(flash());

mongoose.connect("mongodb://localhost:27017/userDB", {
  useUnifiedTopology: true,
  useNewUrlParser: true
});
mongoose.set("useCreateIndex", true);

const userSchema = new mongoose.Schema({
  name: String,
  email: String,
  password: String,
  googleId: String,
  secrets: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Secret"
  }]
});

const secretSchema = new mongoose.Schema({
  leader: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  secret: String
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = new mongoose.model("User", userSchema);
const Secret = new mongoose.model("Secret", secretSchema);

passport.use(User.createStrategy());

passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  User.findById(id, function(err, user) {
    done(err, user);
  });
});

/*passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/secrets"
    //  userProfileURL : "http://www.googleapis.com/oauth2/v3/userinfo"
  },
  function(accessToken, refreshToken, profile, cb) {
    console.log(profile);
    User.findOrCreate({
      googleId: profile.id
    }, function(err, user) {
      return cb(err, user);
    });
  }
));*/


app.get("/", function(req, res) {
  res.render("home");
});

app.get("/auth/google",
  passport.authenticate('google', {
    scope: ["profile"]
  })
);

app.get("/auth/google/secrets",
  passport.authenticate('google', {
    failureRedirect: "/login"
  }),
  function(req, res) {
    // Successful authentication, redirect home.
    res.redirect("/secrets");
  });

  app.get("/login", function(req, res) {
    res.render("login", {
      message: req.flash("message")
    });
  });

  app.get("/register", function(req, res) {
    res.render("register", {
      message: req.flash("message")
    });
  });

app.get("/secrets", function(req, res) {
  Secret.find({
    "secret": {
      $ne: null
    }
  }, function(err, foundUsers) {
    if (err) {
      console.log(err);
    } else {
      console.log(foundUsers.secret);
      if (foundUsers) {
        res.render("secrets", {
          usersWithSecrets: foundUsers
        });
      }
    }
  });
});

app.get("/submit", function(req, res) {
  if (req.isAuthenticated()) {
    User.findById(req.user.id,function(err,foundUser){
      if(err){
        console.log(err);
      }
      else{
        if(foundUser){
          console.log(foundUser.name);
          res.render("submit" , {ename :foundUser});
        }
      }
    });
  } else {
    res.redirect("/login");
  }
});

app.post("/submit", function(req, res) {
  User.findById(req.user.id, function(err, foundUser) {
    if (err) {
      console.log(err);
    } else {
      if (foundUser) {
        const secret = new Secret({
          secret: req.body.secret,
          leader: foundUser._id
        });
        foundUser.secrets = secret;
        secret.save(function(err) {
          if (err) {
            console.log(err);
          } else {
            Secret.find({})
              .populate("leader")
              .exec(function(error, posts) {
                console.log(posts)
              })
          }
          res.redirect("/secrets");
        });
      }
    }
  });
});

app.get("/logout", function(req, res) {
  req.logout();
  res.redirect("/");
});

app.post("/register", function(req, res) {
  User.register({
    name: req.body.name,
    username: req.body.username
  }, req.body.password, function(err, user) {
    if (err) {
      console.log(err);
      if(err.message === "No username was given"){
        req.flash("message","No Email was given")
      }
      else if(err.message === "A user with the given username is already registered"){
        req.flash("message","Email address already is use")
      }
      else{
          req.flash("message",err.message);
      }
    //  res.render("register",{message : req.flash("error","Email is invalid")});
      res.redirect("/register");
    } else {
      passport.authenticate("local")(req, res, function() {
        res.redirect("/secrets");
      });
    }
  });

});

app.post("/login", function(req, res, next) {
  passport.authenticate("local", function(err, user, info) {
    if (err) {
      console.log(err);
    }
    if (!user) {
      //  return res.send(401,{ success : false, message : 'authentication failed' });
      req.flash("message", " Invalid Email or password!");
      res.redirect("login");
      //  return req.flash("message","User not found");
    }
    req.login(user, function(err) {
      if (err) {
        console.log(err);
      }
      res.redirect("/secrets");
      //return res.send({ success : true, message : 'authentication succeeded' });
    });
  })(req, res, next);
});

app.listen(3000, function() {
  console.log("Server started on port 3000");
});
