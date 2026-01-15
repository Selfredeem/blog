var express = require('express');
var router = express.Router();
var crypto = require('crypto');
const mysql = require('./../database');
/* GET home page. */
router.get('/', function(req, res, next) {
    // 获取当前页码，默认为第1页
    var currentPage = parseInt(req.query.page) || 1;
    var pageSize = 5; // 每页显示5条

    // 查询文章总数
    var countQuery = 'SELECT COUNT(*) as total FROM article';
    mysql.query(countQuery, function(err, countResult) {
        if(err) {
            console.log(err);
            return res.status(500).send('数据库查询错误');
        }

        var totalArticles = countResult[0].total;
        var totalPages = Math.ceil(totalArticles / pageSize) || 1; // 确保至少有1页

        // 确保当前页码在有效范围内
        if(currentPage < 1) currentPage = 1;
        if(currentPage > totalPages && totalPages > 0) currentPage = totalPages;

        // 计算偏移量
        var offset = (currentPage - 1) * pageSize;

        // 查询当前页的文章
        var query = 'SELECT * FROM article ORDER BY articleID DESC LIMIT ? OFFSET ?';
        mysql.query(query, [pageSize, offset], function(err, rows, fields) {
            if(err) {
                console.log(err);
                return res.status(500).send('数据库查询错误');
            }

            var articles = rows;
            articles.forEach(function(ele) {
                var year = ele.articleTime.getFullYear();
                var month = ele.articleTime.getMonth() + 1;
                var date = ele.articleTime.getDate();

                // 格式化日期，确保两位数
                month = month < 10 ? '0' + month : month;
                date = date < 10 ? '0' + date : date;

                ele.articleTime = year + '-' + month + '-' + date;
            });

            // 计算页码范围
            var startPage = 1;
            var endPage = totalPages;

            if (totalPages > 5) {
                // 总页数大于5，显示当前页附近的5页
                if (currentPage <= 3) {
                    startPage = 1;
                    endPage = 5;
                } else if (currentPage + 2 >= totalPages) {
                    startPage = totalPages - 4;
                    endPage = totalPages;
                } else {
                    startPage = currentPage - 2;
                    endPage = currentPage + 2;
                }
            }

            // 渲染模板，传递所有必要变量
            res.render("index", {
                articles: articles,
                user: req.session.user || null,
                currentPage: currentPage,
                totalPages: totalPages,
                startPage: startPage,
                endPage: endPage,
                totalArticles: totalArticles
            });
        });
    });
});

router.get('/login', function(req, res, next) {
    // 如果已登录，跳转到首页
    if (req.session.user) {
        res.redirect('/');
        return;
    }
    res.render('login', {
        message: req.query.message || '', // 允许从注册页传递成功消息
        user: null
    });
});
router.post('/login', function(req, res, next) {
    var name = req.body.name;
    var password = req.body.password;
    var hash = crypto.createHash('md5');
    hash.update(password);
    password = hash.digest('hex');
    var query = 'SELECT * FROM author WHERE authorName=' + mysql.escape(name) + ' AND authorPassword=' + mysql.escape(password);
    mysql.query(query, function(err, rows, fields) {
        if(err) {
            console.log(err);
            return;
        }
        var user = rows[0];
        if(!user) {
            res.render('login', {message:'用户名或者密码错误'});
            return;
        }
        req.session.user = user;
        res.redirect('/');
    });
});

// 1. 添加GET注册路由（放在适当位置，比如登录路由后面）
router.get('/register', function(req, res, next) {
    // 如果已登录，跳转到首页
    if (req.session.user) {
        res.redirect('/');
        return;
    }
    res.render('register', {
        message: '',
        username: '',
        user: req.session.user
    });
});

// 2. 添加POST注册路由
router.post('/register', function(req, res, next) {
    // 如果已登录，跳转到首页
    if (req.session.user) {
        res.redirect('/');
        return;
    }

    var username = req.body.username;
    var password = req.body.password;
    var confirmPassword = req.body.confirmPassword;

    // 表单验证
    if (!username || !password || !confirmPassword) {
        return res.render('register', {
            message: '所有字段都必须填写',
            username: username,
            user: null
        });
    }

    // 验证用户名长度
    if (username.length < 3 || username.length > 20) {
        return res.render('register', {
            message: '用户名长度需在3-20个字符之间',
            username: username,
            user: null
        });
    }

    // 验证密码长度
    if (password.length < 6) {
        return res.render('register', {
            message: '密码长度至少6位',
            username: username,
            user: null
        });
    }

    // 验证两次密码是否一致
    if (password !== confirmPassword) {
        return res.render('register', {
            message: '两次输入的密码不一致',
            username: username,
            user: null
        });
    }

    // 检查用户名是否已存在
    var checkQuery = 'SELECT * FROM author WHERE authorName = ' + mysql.escape(username);
    mysql.query(checkQuery, function(err, rows, fields) {
        if (err) {
            console.log('数据库查询错误:', err);
            return res.render('register', {
                message: '系统错误，请稍后重试',
                username: username,
                user: null
            });
        }

        // 用户名已存在
        if (rows.length > 0) {
            return res.render('register', {
                message: '用户名已存在，请换一个用户名',
                username: username,
                user: null
            });
        }

        // 密码加密
        var hash = crypto.createHash('md5');
        hash.update(password);
        var encryptedPassword = hash.digest('hex');

        // 插入新用户到数据库
        var insertQuery = 'INSERT INTO author (authorName, authorPassword) VALUES (?, ?)';
        mysql.query(insertQuery, [username, encryptedPassword], function(err, result) {
            if (err) {
                console.log('数据库插入错误:', err);
                return res.render('register', {
                    message: '注册失败，请稍后重试',
                    username: username,
                    user: null
                });
            }

            // 注册成功，跳转到登录页
            res.render('login', {
                message: '注册成功，请登录',
                user: null
            });
        });
    });
});



router.get('/articles/:articleID', function(req, res, next) {
    var articleID = req.params.articleID;
    var query = 'SELECT * FROM article WHERE articleID=' + mysql.escape(articleID);
    mysql.query(query, function(err, rows, fields) {
        if(err) {
            console.log(err);
            return;
        }
        var query = 'UPDATE article SET articleClick=articleClick+1 WHERE articleID=' + mysql.escape(articleID);
        var article = rows[0];
        mysql.query(query, function(err, rows, fields) {
            if(err) {
                console.log(err)
                return;
            }
            var year = article.articleTime.getFullYear();
            var month = article.articleTime.getMonth() + 1 > 10 ? article.articleTime.getMonth() : '0' + (article.articleTime.getMonth() + 1);
            var date = article.articleTime.getDate() > 10 ? article.articleTime.getDate() : '0' + article.articleTime.getDate();
            article.articleTime = year + '-' + month + '-' + date;
            res.render('article', {article:article,user:req.session.user});
        });
    });
});
router.get('/edit', function(req, res, next) {
    var user = req.session.user;
    if(!user) {
        res.redirect('/login');
        return;
    }
    res.render('edit',{user:req.session.user});
});
router.post('/edit', function(req, res, next) {
    var title = req.body.title;
    var content = req.body.content;
    var author = req.session.user.authorName;
    var query = 'INSERT article SET articleTitle=' + mysql.escape(title) + ',articleAuthor=' + mysql.escape(author) + ',articleContent=' + mysql.escape(content) + ',articleTime=CURDATE()';
    mysql.query(query, function(err, rows, fields) {
        if(err) {
            console.log(err);
            return;
        }
        res.redirect('/');
    });
});
router.get('/friends', function(req, res, next){
    res.render('friends', {user:req.session.user});
});
router.get('/about', function(req, res, next) {
    res.render('about', {user:req.session.user});
});
router.get('/logout', function(req, res, next) {
    req.session.user = null;
    res.redirect('/');
});
router.get('/modify/:articleID', function(req, res, next) {
    var articleID = req.params.articleID;
    var user = req.session.user;
    var query = 'SELECT * FROM article WHERE articleID=' + mysql.escape(articleID);
    if(!user) {
        res.redirect('/login');
        return;
    }
    mysql.query(query, function(err, rows, fields) {
        if(err) {
            console.log(err);
            return;
        }
        var article = rows[0];
        var title = article.articleTitle;
        var content = article.articleContent;
        console.log(title,content);
        res.render('modify', {user:user,title: title, content: content});
    });
});
router.post('/modify/:articleID', function(req, res, next) {
    var articleID = req.params.articleID;
    var user = req.session.user;
    var title = req.body.title;
    var content = req.body.content;
    var query = 'UPDATE article SET articleTitle=' + mysql.escape(title) + ',articleContent=' + mysql.escape(content) + 'WHERE articleID=' + mysql.escape(articleID);
    mysql.query(query, function(err, rows, fields) {
        if(err) {
            console.log(err);
            return;
        }
        res.redirect('/');
    });
});
router.get('/delete/:articleID', function(req, res, next) {
    var articleID = req.params.articleID;
    var user = req.session.user;
    var query = 'DELETE FROM article WHERE articleID=' + mysql.escape(articleID);
    if(!user) {
        res.redirect('/login');
        return;
    }
    mysql.query(query, function(err, rows, fields) {
        res.redirect('/')
    });
});
module.exports = router;