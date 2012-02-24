/*
 * errs.js: Simple error creation and passing utilities.
 *
 * (C) 2012, Nodejitsu Inc.
 * MIT LICENSE
 *
 */
 
var events = require('events'),
    util = require('util');

//
// Container for registered error types.
//
exports.registered = {};

//
// ### function create (type, opts)
// #### @type {string} **Optional** Registered error type to create
// #### @opts {string|object|Array|function} Options for creating the error:
//   * `string`:   Message for the error
//   * `object`:   Properties to include on the error
//   * `array`:    Message for the error (' ' joined).
//   * `function`: Function to return error options.
//
// Creates a new error instance for with the specified `type` 
// and `options`. If the `type` is not registered then a new 
// `Error` instance will be created.
//
exports.create = function (type, opts) {
  if (!arguments[1] && !exports.registered[type]) {
    opts = type;
    type = null;
  }
  
  //
  // If the `opts` has a `stack` property assume
  // that it is already an error instance.
  //
  if (opts && opts.stack) {
    return opts;
  }
  
  var message,
      errorProto,
      error;
  
  //
  // Parse arguments liberally for the message
  //
  if (typeof opts === 'function') {
    opts = opts();
  }
  
  if (Array.isArray(opts)) {
    message = opts.join(' ');
    opts = null;
  }
  else if (opts) {
    switch (typeof opts) {
      case 'string': 
        message = opts || 'Unspecified error'; 
        opts = null;
        break;
      case 'object': 
        message = (opts && opts.message) || 'Unspecified error';
        break;
      default:
        message = 'Unspecified error';
        break;
    }    
  }
  
  //
  // Instantiate a new Error instance or a new
  // registered error type (if it exists). 
  //
  errorProto = type && exports.registered[type] || Error;
  error = new (errorProto)(message);
  
  if (!error.name || error.name === 'Error') {
    error.name = errorProto.name || 'Error';
  }
  
  //
  // Capture a stack trace if it does not already exist and 
  // remote the part of the stack trace referencing `errs.js`.
  //
  if (!error.stack) {
    Error.call(error);
    Error.captureStackTrace(error, arguments.callee);
  }
  else {
    error.stack = error.stack.split('\n')
    error.stack.splice(1, 1);
    error.stack = error.stack.join('\n');
  }  
    
  //
  // Copy all options to the new error instance.
  //
  if (opts) {
    Object.keys(opts).forEach(function (key) {
      error[key] = opts[key];
    });
  }
  
  return error;
};

//
// ### function handle (error, callback)
// #### @error {string|function|Array|object} Error to handle
// #### @callback {function} **Optional** Continuation to pass the error to.
//
// Attempts to instantiate the given `error`. If the `error` is already a properly
// formed `error` object (with a `stack` property) it will not be modified. 
//
// * If a `callback` is supplied, it is invoked with the `error`.
// * If no `callback`, return a new `EventEmitter` which emits `error` 
//   on `process.nextTick()`.
//
exports.handle = function (error, callback) {
  error = exports.create(error);
  
  if (callback) {
    return callback(error);
  } 
  
  var emitter = new events.EventEmitter();
  process.nextTick(function () { emitter.emit('error', error); });
  return emitter;
};

//
// ### function register (type, proto)
// #### @type {string} **Optional** Type of the error to register.
// #### @proto {function} Constructor function of the error to register.
//
// Registers the specified `proto` to `type` for future calls to
// `errors.create(type, opts)`.
//
exports.register = function (type, proto) {
  if (arguments.length === 1) {
    proto = type;
    type = proto.name.toLowerCase();
  }
  exports.registered[type] = proto;
};

//
// ### function unregister (type)
// #### @type {string} Type of the error to unregister.
//
// Unregisters the specified `type` for future calls to
// `errors.create(type, opts)`.
//
exports.unregister = function (type) {
  delete exports.registered[type];
};
