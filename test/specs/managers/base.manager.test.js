'use strict';

var BaseManager = require('../../../src/lib/managers/base.manager'),
  chai = require('chai'),
  chaiAsPromised = require('chai-as-promised'),
  sinon = require('sinon'),
  q = require('q'),
  expect = chai.expect,
  should = chai.should();

chai.use(chaiAsPromised);

var correctPhrases = require('../../fixtures/phrases').correct;
var utilsPromises = require('../../utils/promises');

var modelFixture = function(){
  this.getId = () => 'myid';
};

var storeAPI = { 
  add: () => true
};

describe.only('Base manager', function() {

  it('exposes the needed prototype', function() {
    expect(BaseManager.prototype).to.respondTo('register');
    expect(BaseManager.prototype).to.respondTo('registerWithoutDomain');
    expect(BaseManager.prototype).to.respondTo('_register');
    expect(BaseManager.prototype).to.respondTo('unregister');
    expect(BaseManager.prototype).to.respondTo('_unregister');
    expect(BaseManager.prototype).to.respondTo('compile');
    expect(BaseManager.prototype).to.respondTo('_compile');
    expect(BaseManager.prototype).to.respondTo('__preAdd');
    expect(BaseManager.prototype).to.respondTo('_addToStore');
    expect(BaseManager.prototype).to.respondTo('__postAdd');
    expect(BaseManager.prototype).to.respondTo('validate');
    expect(BaseManager.prototype).to.respondTo('resetItems');
    expect(BaseManager.prototype).to.respondTo('_extractDomainFromId');
    expect(BaseManager.prototype).to.respondTo('_extractVirtualDomainFromId');
    expect(BaseManager.prototype).to.respondTo('getById');
    expect(BaseManager.prototype).to.respondTo('getByVirtualDomain');
    expect(BaseManager.prototype).to.respondTo('getByDomain');
    expect(BaseManager.prototype).to.respondTo('load');
    expect(BaseManager.prototype).to.respondTo('save');
  });


  describe('Item registration', function() {
    var manager, mockStore, mockModel, stubEvents;

    beforeEach(function() {
      mockStore = sinon.mock(storeAPI);

      manager = new BaseManager({
        itemName: 'phrases',
        store: storeAPI,
        model: modelFixture,
        validator: function(item) {
          return Promise.resolve(item);
        }
      });

      stubEvents = sinon.stub();

      manager.events = {
        emit: stubEvents
      };

    });

    afterEach(function(){
      mockStore.restore();
    });

    it('should allow to register an array of items', function(done) {
      mockStore.expects('add').twice();

      manager.register('domain', [{
        id: '1'
      }, {
        id: '2'
      }])
        .should.be.fulfilled
        .then(function(result) {
          expect(result).to.be.an('array');
          expect(result.length).to.equals(2);
          mockStore.verify();
        })
        .should.be.fulfilled.notify(done);
    });

    it('should allow to register a single item', function(done) {
      manager.register('domain', {
        id: '1'
      })
        .should.be.fulfilled
        .then(function(result) {
          expect(result).to.be.an('object');
        })
        .should.notify(done);
    });

    it('should emit a debug event when the item has been registered', function(done) {
      manager.register('domain', {
        id: '1'
      })
        .should.be.fulfilled
        .then(function() {
          expect(stubEvents.callCount).to.be.above(0);
          expect(stubEvents.calledWith('debug', 'phrases:registered')).to.equals(true);
        })
        .should.be.fulfilled.notify(done);
    });

    describe('Secure methods called', function() {
      var spyCompile, spyValidate, spyCompile, spyRegister, spyAddToList;

      beforeEach(function() {
        spyRegister = sinon.spy(manager, '_register');
        spyCompile = sinon.spy(manager, 'compile');
        spyValidate = sinon.spy(manager, 'validate');
        spyCompile = sinon.spy(manager, '_compile');
        spyAddToList = sinon.spy(manager, '_addToStore');
      });

      afterEach(function() {
        spyRegister.restore();
        spyCompile.restore();
        spyValidate.restore();
        spyCompile.restore();
        spyAddToList.restore();
      });

      it('should call the compilation and validation methods when registering', function(done) {

        manager.register('test-domain', 'Something to register')
          .should.be.fulfilled
          .then(function() {
            expect(spyCompile.callCount).to.equals(1);
            expect(spyCompile.callCount).to.equals(1);
            expect(spyValidate.callCount).to.equals(1);
          })
          .should.be.fulfilled.notify(done);
      });

      it('should call the _register method with the domain', function(done) {

        manager.register('test-domain', 'Something to register')
          .should.be.fulfilled
          .then(function() {
            expect(spyRegister.callCount).to.equals(1);
            expect(spyRegister.calledWith('test-domain', 'Something to register')).to.equals(true);
          })
          .should.be.fulfilled.notify(done);
      });

      it('should call the _addToStore method with the domain', function(done) {

        manager.register('test-domain', 'Something to register')
          .should.be.fulfilled
          .then(function() {
            expect(spyAddToList.callCount).to.equals(1);
            expect(spyAddToList.calledWith('test-domain')).to.equals(true);
          })
          .should.be.fulfilled.notify(done);
      });

    });

    describe('when validation fails', function() {
      var stubEvents, aManager, mockStore;

      beforeEach(function() {
        mockStore = sinon.mock(storeAPI);

        aManager = new BaseManager({
          model: modelFixture,
          store: storeAPI,
          itemName: 'testObject',
          validator: function(item) {
            if (item.id === 'invalid') {
              return Promise.reject();
            } else {
              return Promise.resolve(item);
            }
          }
        });

        stubEvents = sinon.stub();

        aManager.events = {
          emit: stubEvents
        };
      });

      afterEach(function(){
        mockStore.restore();
      });

      describe('Validation fail', function() {

        it('should emit an error when the registering fails because the validation fails', function(done) {
          aManager.register('domain', {
            id: 'invalid'
          })
            .should.be.fulfilled
            .then(function() {
              expect(stubEvents.callCount).to.be.above(0);
              expect(stubEvents.calledWith('warn', 'testObject:not:registered')).to.equals(true);
              mockStore.expects('add').never();
              mockStore.verify();
            })
            .should.be.fulfilled.notify(done);
        });

        it('should return not registered when the registering fails because the validation fails', function(done) {
          aManager.register('domain', {
            id: 'invalid'
          })
            .should.be.fulfilled
            .then(function(result) {
              expect(result.registered).to.equals(false);
              mockStore.expects('add').never();
              mockStore.verify();
            })
            .should.be.fulfilled.notify(done);
        });

      });

      describe('Compilation fail', function() {
        var stubCompile;

        beforeEach(function() {
          stubCompile = sinon.stub(aManager, 'compile', function() {
            return false;
          });
        });

        afterEach(function() {
          stubCompile.restore();
        });

        it('should emit an error when the registering fails because the compilation fails', function(done) {
          aManager.register('domain', {
            id: 'valid'
          })
            .then(function() {
              expect(stubEvents.callCount).to.be.above(0);
              expect(stubEvents.calledWith('warn', 'testObject:not:registered')).to.equals(true);
              mockStore.expects('add').never();
              mockStore.verify();
              done();
            });
        });

        it('should return the unregistered state when the compilation fails', function(done) {
          aManager.register('domain', {
            id: 'valid'
          })
            .should.be.fulfilled
            .then(function(result) {
              expect(result.registered).to.equals(false);
              mockStore.expects('add').never();
              mockStore.verify();
            })
            .should.notify(done);
        });
      });
    });
  });



  describe('Item reseting', function() {
    var manager;

    beforeEach(function() {

      manager = new BaseManager({
        item: '__mything'
      });

      manager.__mything = 'SanFrancisco';

    });

    afterEach(function() {
      manager.__mything = null;
    });

    it('Resets the item to an empty object', function() {
      manager.resetItems();
      expect(Object.keys(manager.__mything).length).to.equals(0);
    });
  });


  describe('Domain extraction', function() {

    var manager = new BaseManager({
      item: '__mything'
    });

    var testItems = [{
      id: 'booqs:demo!loginuser',
      value: 'booqs:demo'
    }, {
      id: 'test-client!myphrase!:parameter',
      value: 'test-client'
    }, {
      id: 'booqs:demo!bookWarehouseDetailMock!:id',
      value: 'booqs:demo'
    }, {
      id: 'booqs:demo!UserModel',
      value: 'booqs:demo'
    }];

    it('Extracts all the domains correctly', function() {
      testItems.forEach(function(item) {
        expect(manager._extractDomainFromId(item.id)).to.equals(item.value);
      });
    });

  });

  describe('Items unregistration', function() {
    var spyUnregister, manager, stubEvents;

    beforeEach(function() {
      manager = new BaseManager({
        item: '__mything',
        itemName: 'goodies'
      });

      spyUnregister = sinon.spy(manager, '_unregister');

      stubEvents = sinon.stub();
      //Mock the composr external methods
      manager.events = {
        emit: stubEvents
      };

    });

    it('Should be able to receive a single item', function() {
      manager.unregister('mydomain', 'testId');

      expect(spyUnregister.callCount).to.equals(1);
    });

    it('Should be emit info about the event', function() {
      manager.unregister('mydomain', 'testId');

      expect(stubEvents.callCount).to.equals(2);
      expect(stubEvents.calledWith('debug', 'goodies:unregister:testId')).to.equals(true);
    });

    it('should warn about an unimplemented method', function(){
      manager.unregister('mydomain', 'testId');

      expect(stubEvents.callCount).to.equals(2);
      expect(stubEvents.calledWith('warn', '_unregister not implemented')).to.equals(true);
    });

    it('Should be able to receive an array', function() {
      manager.unregister('mydomain', ['testId', 'testId', 'testId', 'testId', 'testId']);

      expect(spyUnregister.callCount).to.equals(5);
    });
  });

  describe('Register without domain', function() {
    var stubRegister, manager;

    before(function() {
      manager = new BaseManager({
        item: '__mything',
        itemName: 'goodies'
      });

      stubRegister = sinon.stub(manager, 'register', utilsPromises.resolvedPromise);
    });

    it('Calls the register method with the domain', function(done) {
      var examplePhrases = [{
        'id': 'domainTest!phrase'
      }, {
        'id': 'domainTest!phrase2'
      }, {
        'id': 'domainTest!phrase3'
      }, {
        'id': 'domainTwo!phrase'
      }];

      manager.registerWithoutDomain(examplePhrases)
        .then(function() {
          expect(stubRegister.callCount).to.equals(2);
          expect(stubRegister.calledWith('domainTest')).to.equals(true);
          expect(stubRegister.calledWith('domainTwo')).to.equals(true);
        })
        .should.notify(done);
    });

  });

});
