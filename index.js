window.$ = require('jquery-browserify')
window._ = require('lodash')
window.l = l
window.a = a

var assert = require('assert')
var Handlebars = require('handlebars')

function l() {
  console.log.apply(console, arguments)
  return arguments[0]
};

function a(o) {
  var s = ' ' + new Error('').stack.split('\n')[2].trim()
  assert(o, 'falsy' + s)
  if (o.length !== undefined) assert(o.length > 0, 'no length' + s)
  return o
}

function climb(el, sel) {
  if (el.is(sel)) return el
  return climb(el.parent(), sel)
}

// this works because all .partial are inside a single div
function partial(el) {
  var p = climb(el, '.partial')
  a(p)
  // l('partial', p[0])
  return p
}

function name(partial) {
  return a(partial.find('.name')).attr('value')
}

function field(el) {
  var p = climb(el, 'tr')
  a(p)
  // l('tr', p[0], p.index())
  return p
}

function map ($arr, fn) {
  var arr = $.makeArray($arr)
  return arr.map(fn)
}

function render(partial) {
  var pname = name(partial)
  var templ = a(partial.find('.template')).text()

  var fields = partial.find('tr')
  var context = map(fields, function(el) { return $(el) })
    .reduce(function(acc, el) {
      if (el.find('th').length) return acc

      var varname = a(el.find('.varname')).attr('value')
      var value = a(el.find('.value')).attr('value')
      var fallback = a(el.find('.default')).attr('value')

      acc[varname] = value || fallback
      return acc
    }, {})

  var output = Handlebars.compile(templ)(context)

  var context = {}
  context[pname] = output
  return context
}

var context = {
  // templatename: output
}
function renderMaster(data) {
  spin(true)
  context = _.extend(context, data)
  console.log('master context', context)

  var templ = a($('#master')).attr('value')
  var output = Handlebars.compile(templ)(context)
  l('output', output)
  $('#output').attr('value', output)
    .trigger('keyup') // to adjust the height

  // so users can copy-paste into emails
  $('#renderedOutput').html(output)

  // save the state of the UI, so you can't lose work if tab is close
  storage('state', $('#state').html())
  spin(false)
}

function storage(k, v) {
  if (!window.localStorage) return

  if (!v) return localStorage[k]
  localStorage[k] = v
  return v
};

function spin(bool) {
  if (bool) return $('#spin').css('visibility', 'visible')
  else $('#spin').css('visibility', 'hidden')
};

$(function() {
  spin(true)
  var state = storage('state')
  if (state) $('#state').html(state)
  console.log(state)

  renderMaster(
    map($('.partial'), function(el) {
      el = $(el)
      return render(el)
    })
    .reduce(_.extend, {})
  )
  spin(false)

  $('.partial .name')
    .live('keyup paste cut', onName)
    .each(nameHelperText)

  function onName(e) {
    el = $(e.target)
    // put state in html so it is saveable
    // we do not use .val() anywhere else, b/c it doesn't write to html
    el.attr('value', el.val())
    nameHelperText(null, el)
    renderMaster(render(partial(el)))
  }
  function nameHelperText(_, el) {
    el = $(el)
    var name = el.attr('value')
    a(el.siblings('.helpertext'))
      .text('{{'+name+'}}')
  }


  $('.partial table .varname')
    .live('keyup paste cut', onVarname)
    .each(varnameHelperText)

  function onVarname(e) {
    console.log('vn',e)
    var el = $(e.target)
    el.attr('value', el.val()) // put state in html so it is saveable
    varnameHelperText(null, el)
    ensureEmptyLastField(el)
    renderMaster(render(partial(el)))
  }
  function varnameHelperText(_, el) {
    el = $(el)
    var varname = el.attr('value')
    var f = field(el)
    a(f.find('.helpertext'))
      .text('{{'+varname+'}}')
  };

  $('.partial table .value').live('keyup paste cut', onValue)
  $('.partial table .default').live('keyup paste cut', onValue)
  function onValue(e) {
    var el = $(e.target)
    el.attr('value', el.val())
    renderMaster(render(partial(el)))
  }
  $('.partial .template').live('keyup paste cut', onTemplate)
  function onTemplate(e) {
    var el = $(e.target)
    el.text(el.val())
    renderMaster(render(partial(el)))
  }
  $('#master').on('keyup paste cut', onMaster)
  function onMaster(e) {
    var el = $(e.target)
    el.text(el.val())
    renderMaster()
  }

  //
  // buttons
  //

  // clear values
  $('.partial .clearvalues').live('click', function(e) {
    var el = $(e.target)
    var p = partial(el)
    var fields = p.find('.value')
    a(fields)
    fields.attr('value', null) // put state in html so it is saveable
    fields.trigger('cut')
  })

  // delete template
  $('.partial .del').live('click', function(e) {
    var el = $(e.target)
    var p = partial(el)
    l('p', p)
    l(p.siblings().length)
    if (p.siblings().length === 0) return // can't delete the last one
    p.slideUp('fast', function() {
      p.remove()
      renderMaster()
    })
  })

  $('#addtemplate').on('click', function(e) {
    l('bang')
    var last = $('.partial:last')
    var p = last.clone()
    var fields = a(p.find('tr:not(:has(th))'))
    var first = fields.first()
    clearField(first)
    first.siblings(':not(:has(th))').remove()

    p.find('.template').text('')
    p.find('.name').attr('value', null)
    p.find('.helpertext:first').text('{{}}')
    p.hide()
    last.after(p)
    p.slideDown('fast', function() {
      renderMaster()
    })
  })
})

function fieldEmpty(tr) {
  var contents =
    [ '.varname', '.value', '.default']
    .map(function(classname) {
      return a(tr.find(classname)).attr('value')
    }).join('').trim()
  return contents == ''
}

//
// interaction
//
function ensureEmptyLastField(el) {
  var p = partial(el)
  var last = p.find('tr:last')
  a(last)
  l(last)
  if (fieldEmpty(last)) return

  var another = last.clone()
  clearField(another)
  last.after(another)
}

function clearField(tr) {
  [ '.varname', '.value', '.default']
  .forEach(function(classname) {
    tr.find(classname).attr('value', null)
  })
  tr.find('.helpertext').text('{{}}')
}
