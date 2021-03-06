
const express = require('express');
const path = require('path');
const config = require('config-lite')(__dirname);
const logger = require('morgan');
const fs = require('fs');
const rfs = require('rotating-file-stream');
// const cookieParser = require('cookie-parser');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const router = require('./routes/index');
const httpStatus = require('./utils/httpStatus');

const swaggerUi = require('swagger-ui-express')
const swaggerDocument = require('./swagger.json')

// 生成一个 express 实例
const app = express();

// 指定网页渲染模板
app.set('views', path.join(__dirname, 'views')); // 设置 views 文件夹为存放视图文件的目录
app.set('view engine', 'ejs'); // 设置视图模板引擎 ejs
app.engine('html', require('ejs').renderFile);

const logDirectory = path.join(__dirname, 'logs');

// ensure log directory exists
if (!fs.existsSync(logDirectory)) {
    fs.mkdirSync(logDirectory);
}

function pad(num) {
    return (num > 9 ? '' : '0') + num;
}

// create a rotating write stream
const accessLogStream = rfs((time, index) => {
    if (!time) {
        return 'file.log';
    }

    const month = time.getFullYear() + '' + pad(time.getMonth() + 1);
    const day = pad(time.getDate());
    const hour = pad(time.getHours());
    const minute = pad(time.getMinutes());

    return month + '/' + month + day + '-' + hour + minute + '-' + index + '-file.log';
}, {
    interval: '1d', // rotate daily
    path: logDirectory,
    initialRotation: true
});

// 自定义输出日志格式
logger.format('combined2', ':remote-addr - :remote-user [:date[iso]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent"');

app.use(logger('combined2', { stream: accessLogStream })); // 加载日志中间件-输出到文件
if (process.env.NODE_ENV === 'development') {
    app.use(logger('dev')); // 加载日志中间件
}

app.use(express.json()); // 加载解析 json 的中间件
app.use(express.urlencoded({ extended: false })); // 加载解析urlencoded请求体的中间件
// 加载解析 cookie 的中间件 传入‘secret’作为密钥，可不传(req.cookies/req.signedCookies)
// app.use(cookieParser('secret'));
app.use(session({
    secret: 'ThisIsSecret',
    resave: true,
    saveUninitialized: false,
    store: new FileStore({
        reapInterval: -1, // 以秒为单位清除过期session，默认为1h，-1表示不需要。设为 -1 否则mocha测试时不会退出
    }),
}))
app.use(express.static(path.join(__dirname, 'public'))); // 设置public文件夹为存放静态文件的目录

// add router
router(app);

// add swagger
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument))

// 404
app.use(httpStatus.resourceNotFound);

app.set('port', config.port);

module.exports = app
