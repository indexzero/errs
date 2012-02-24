# errs [![Build Status](https://secure.travis-ci.org/flatiron/errs.png)](http://travis-ci.org/flatiron/errs)

Simple error creation and passing utilities focused on:

* [Creating Errors](#creating-errors)
* [Reusing Error Types](#reusing-types)
* [Optional Callback Invocation](#optional-invocation)

<a name="creating-errors" />
## Creating Errors

You should know by now that [a String is not an Error][0]. Unfortunately the `Error` constructor in Javascript isn't all that convenient either. How often do you find yourself in this situation? 

``` js
  var err = new Error('This is an error. There are many like it.');
  err.someProperty = 'more syntax';
  err.someOtherProperty = 'it wont stop.';
  err.notEven = 'for the mayor';
  
  throw err;
```

Rest your fingers, `errs` is here to help. The following is equivalent to the above:

``` js
  var errs = require('errs');
  
  throw errs.create({
    message: 'This is an error. There are many like it.',
    someProperty: 'more syntax',
    someOtherProperty: 'it wont stop.',
    notEven: 'for the mayor'
  });
```

<a name="reusing-types" />
## Reusing Error Types

`errs` also an [inversion of control][1] interface for easily reusing custom error types across your application:

``` js
  //
  // file-a.js: Create and register your error type.
  //
  var util = require('util'),
      errs = require('errs');

  var MyError = function (msg) {
    Error.call(this, msg);
    this.isCustom = true;
  }
  
  util.inherits(MyError, Error);
  errs.register('myerror', MyError);
  
  //
  // file-b.js: Use your error type.
  //
  var errs = require('errs');
  
  throw errs.create('myerror', {
    and: 'you can',
    add: 'custom properties too.'
  });
```

<a name="optional-invocation" />
## Optional Callback Invocation

Node.js handles asynchronous IO through the elegant `EventEmitter` API. In many scenarios the `callback` may be optional because you are returning an `EventEmitter` for piping or other event multiplexing. This complicates code with a lot of boilerplate:

``` js
  function importantFeature(callback) {
    return someAsyncFn(function (err) {
      if (err) {
        if (callback) {
          return callback(err);
        }
        
        throw err;
      }
    });
  }
```

`errs` it presents a common API for both emitting `error` events and invoking continuations (i.e. callbacks) with errors;

``` js
  function importantFeature(callback) {
    return someAsyncFn(function (err) {
      if (err) {
        return errs.handle(err, callback);
      }
    });
  }
```

If a `callback` is supplied to `errs.handle()` it will be invoked with the error. It no `callback` is provided then an `EventEmitter` is returned which emits an `error` event on the next tick.

## Methods
The `errs` modules exposes some simple utility methods:

* `.create(type, opts)`: Creates a new error instance for with the specified `type` and `opts`. If the `type` is not registered then a new `Error` instance will be created.
* `.register(type, proto)`: Registers the specified `proto` to `type` for future calls to `errors.create(type, opts)`.
* `.unregister(type)`: Unregisters the specified `type` for future calls to `errors.create(type, opts)`.
* `.handle(err, callback)`: Attempts to instantiate the given `error`. If the `error` is already a properly formed `error` object (with a `stack` property) it will not be modified.

## Installation

### Installing npm (node package manager)

``` bash
  $ curl http://npmjs.org/install.sh | sh
```

### Installing errs

``` bash
  $ [sudo] npm install errs
```

## Tests
All tests are written with [vows][2] and should be run with [npm][3]:

``` bash
  $ npm test
```

#### Author: [Nodejitsu Inc.](http://www.nodejitsu.com)
#### Contributors: [Charlie Robbins](http://github.com/indexzero), [Nuno Job](http://github.com/dscape)
#### License: MIT

[0]: http://www.devthought.com/2011/12/22/a-string-is-not-an-error/
[1]: http://martinfowler.com/articles/injection.html
[2]: https://vowsjs.org
[3]: https://npmjs.org
