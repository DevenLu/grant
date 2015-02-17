
var config = require('../config')
var flows = {
  1: require('../flow/oauth1'),
  2: require('../flow/oauth2'),
  getpocket: require('../flow/getpocket')
}


function Grant () {
  this.register.attributes = {
    pkg: require('../../package.json')
  }
}

Grant.prototype.register = function (server, options, next) {
  var self = this
  self.config = config.init(options)
  this.register.config = self.config

  server.route({
    method:['GET', 'POST'],
    path:'/connect/{provider}/{override?}',
    handler: function (req, res) {
      if (req.params.override == 'callback') return next()

      req.session.set('grant', {
        provider:req.params.provider,
        override:req.params.override,
        dynamic:req.payload
      })

      connect(req, res)
    }
  })

  function connect (req, res) {
    var grant = req.session.get('grant')
    var provider = config.provider(self.config, grant)
    var flow = flows[provider.oauth]

    if (provider.oauth == 1) {
      flow.step1(provider, function (err, data) {
        if (err) return res.redirect(provider.callback + '?' + err)
        grant.step1 = data
        var url = flow.step2(provider, data)
        res.redirect(url)
      })
    }

    else if (provider.oauth == 2) {
      grant.state = provider.state
      var url = flow.step1(provider)
      res.redirect(url)
    }

    else if (provider.custom) {
      flow = flows[provider.name]
      flow.step1(provider, function (err, data) {
        if (err) return res.redirect(provider.callback + '?' + err)
        grant.step1 = data
        var url = flow.step2(provider, data)
        res.redirect(url)
      })
    }
  }

  server.route({
    method:'GET',
    path:'/connect/{provider}/callback',
    handler: function (req, res) {
      var grant = req.session.get('grant')
      var provider = config.provider(self.config, grant)
      var flow = flows[provider.oauth]

      if (provider.oauth == 1) {
        flow.step3(provider, grant.step1, req.query, function (err, url) {
          if (err) return res.redirect(provider.callback + '?' + err)
          res.redirect(url)
        })
      }

      else if (provider.oauth == 2) {
        flow.step2(provider, req.query, grant, function (err, data) {
          if (err) return res.redirect(provider.callback + '?' + err)
          var url = flow.step3(provider, data)
          res.redirect(url)
        })
      }

      else if (provider.custom) {
        flow = flows[provider.name]
        flow.step3(provider, grant.step1, function (err, url) {
          if (err) return res.redirect(provider.callback + '?' + err)
          res.redirect(url)
        })
      }
    }
  })

  next()
}

exports = module.exports = Grant