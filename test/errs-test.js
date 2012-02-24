/*
 * errs-test.js: Tests for the `errs` module.
 *
 * (C) 2012, Nodejitsu Inc.
 * MIT LICENSE
 *
 */
 
var assert = require('assert'),
    vows = require('vows'),
    errs = require('../lib/errs'),
    fixtures = require('./fixtures'),
    macros = require('./macros');

var opts = [{
  foo: 'bar',
  status: 404,
  whatever: 'some other property'
}, {
  testing: true,
  'some-string': 'is-a-value',
  message: 'This is an error. There are many like it.'
}, {
  'a-function': 'that returns an object',
  should: true,
  have: 4,
  properties: 'yes'
}]

vows.describe('errs').addBatch({
  "Using errs module": {
    "the register() method": {
      "should register the prototype": function () {
        errs.register('named', fixtures.NamedError);
        assert.equal(errs.registered['named'], fixtures.NamedError);
      },
      "should register an error without providing its name": function () {
        errs.register(fixtures.AnError);
        assert.equal(errs.registered['anerror'], fixtures.AnError);
      }
    },
    "the create() method with": {
      "a string": macros.create.string('An error as a string'),
      "no parameters": macros.create.string('An error as a string'),
      "an object": {
        "that has no message": macros.create.object(opts[0]),
        "that has a message": macros.create.object(opts[1])
      },
      "an error": macros.create.err(new Error('An instance of an error')),
      "a function": macros.create.fn(function () {
        return opts[2];
      }),
      "a registered type": {
        "that exists": macros.create.registered('named', fixtures.NamedError, opts[1]),
        "that doesnt exist": macros.create.registered('bad', null, opts[1])
      }
    },
    "the handle() method": {
      "with a callback": {
        topic: function () {
          var err = this.err = errs.create('Some async error');
          errs.handle(err, this.callback.bind(this, null));
        },
        "should invoke the callback with the error": function (_, err) {
          assert.equal(err, this.err);
        }
      },
      "with no callback": {
        topic: function () {
          var err = this.err = errs.create('Some emitted error'),
              emitter = errs.handle(err);

          emitter.once('error', this.callback.bind(this, null))
        },
        "should invoke the callback with the error": function (_, err) {
          assert.equal(err, this.err);
        }
      }
    }
  }
}).addBatch({
  "Using errs module": {
    "the unregister() method": {
      "should unregister the prototype": function () {
        errs.unregister('named');
        assert.isTrue(!errs.registered['named']);
      }
    }
  }
}).export(module);
