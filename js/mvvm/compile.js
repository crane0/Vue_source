/*
* 模板解析
* */

//在mvvm.js中会调用
function Compile(el, vm) {
  // 保存vm，this指向Compile的实例
  this.$vm = vm;
  // 保存el元素
  this.$el = this.isElementNode(el) ? el : document.querySelector(el);

  //还是为了保证，el元素的存在
  if (this.$el) {
    /*
    *  1. 将el中所有了子节点转移到fragment对象中, 并保存fragment
    *   node2Fragment是指 2 to
    * */
    this.$fragment = this.node2Fragment(this.$el);
    // 2. 编译fragment中所有层次子节点
    this.init();
    // 3. 将编译好的fragment添加到el中显示
    this.$el.appendChild(this.$fragment);
  }
}

Compile.prototype = {
  node2Fragment: function (el) {
    //注意，这是var了2个变量，child没有赋值而已
    var fragment = document.createDocumentFragment(),
      child;

    /*
    * 节点包括空格/回车，产生的文本节点！！！
    * 将原生节点拷贝到fragment
    *   一个节点只能有一个父亲
    *   从el中移除child节点, 并将child添加为fragment的子节点
    *
    * 所以，当执行到此时，页面上的{{xxx}}就会消失
    * */
    while (child = el.firstChild) {
      fragment.appendChild(child);
    }

    return fragment;
  },

  init: function () {
    this.compileElement(this.$fragment);
  },

  /*
  编译指定元素/fragment的--所有层次--子节点(利用递归调用)
   */
  compileElement: function (el) {
    // 得到所有子节点（2个文本节点，1个元素节点（其中还有一个文本节点））
    var childNodes = el.childNodes,
      me = this;
      /*
      * []是数组的实例，会调用原型，所以这样写没问题，伪数组转真数组
      *   遍历所有子节点，注意还有空格/回车，产生的文本节点！！！
      * */

    [].slice.call(childNodes).forEach(function (node) { // 某个子节点
      // 得到节点的文本内容
      var text = node.textContent;
      // 用于匹配大括号表达式的正则对象
      var reg = /\{\{(.*)\}\}/;
      // 元素节点
      if (me.isElementNode(node)) {
        // 编译元素节点中的指令属性
        me.compile(node);
        // 大括号表达式格式的文本节点
      } else if (me.isTextNode(node) && reg.test(text)) {
        // 编译大括号表达式
        me.compileText(node, RegExp.$1);  //$1代表，第一个分组对象（小括号中的）
      }
      // 如果当前子节点还有子节点
      if (node.childNodes && node.childNodes.length) {
        // 递归用调实现所有层次节点的编译
        me.compileElement(node);
      }
    });
  },

  compile: function (node) {
    //获取元素节点中，所有的属性节点
    var nodeAttrs = node.attributes,
      me = this;

    [].slice.call(nodeAttrs).forEach(function (attr) {
      var attrName = attr.name;
      //判断 v-
      if (me.isDirective(attrName)) {
        //获取指令的属性值
        var exp = attr.value;
        //过滤了属性名（v-被去除了），指令名不包括v-
        var dir = attrName.substring(2);
        // 事件指令，以on开头
        if (me.isEventDirective(dir)) {
          compileUtil.eventHandler(node, me.$vm, exp, dir);
          // 普通指令
        } else {
          //dir可能是text,html,model,show等
          compileUtil[dir] && compileUtil[dir](node, me.$vm, exp);
        }

        node.removeAttribute(attrName);
      }
    });
  },

  compileText: function (node, exp) {
    compileUtil.text(node, this.$vm, exp);
  },

  isDirective: function (attr) {
    //indexOf判断指定字符，首次出现的位置，对大小写敏感！
    return attr.indexOf('v-') == 0;
  },

  isEventDirective: function (dir) {
    return dir.indexOf('on') === 0;
  },

  isElementNode: function (node) {
    return node.nodeType == 1;
  },

  isTextNode: function (node) {
    return node.nodeType == 3;
  }
};

// 包含n个解析指令/大括号表达的函数的工具对象
var compileUtil = {
  // 解析v-text/大括号表达式
  text: function (node, vm, exp) {
    this.bind(node, vm, exp, 'text');
  },
  //解析v-html
  html: function (node, vm, exp) {
    this.bind(node, vm, exp, 'html');
  },



  /*
  * 双向的数据绑定，建立在单项数据绑定的基础上
  *   给元素添加了input监听，
  * */
  model: function (node, vm, exp) {
    //实现页面的初始化显示
    this.bind(node, vm, exp, 'model');

    var me = this,
      //得到表达式的值
      val = this._getVMVal(vm, exp);
    //输入数据发生改变时，调用这个回调函数
    node.addEventListener('input', function (e) {
      //读取输入框最新的数据
      var newValue = e.target.value;
      if (val === newValue) {
        return;
      }

      /*
      * 将最新的值，保存到表达式对应的属性上，
      * 会导致observer.js中，set方法的调用，更新界面对应的节点
      * */
      me._setVMVal(vm, exp, newValue);
      val = newValue;
    });
  },
  //解析v-class
  class: function (node, vm, exp) {
    this.bind(node, vm, exp, 'class');
  },

  // 调用对应的节点更新函数，去更新节点（非事件处理）
  bind: function (node, vm, exp, dir) {
    // 根据指令名得到对应的节点更新函数
    var updaterFn = updater[dir + 'Updater'];
    // 执行更新函数更新节点
    updaterFn && updaterFn(node, this._getVMVal(vm, exp));
    //上面2个语句是初始化显示！！！

    /*
    * 真正的更新
    * 更新表达式（大括号表达式/非事件指令表达式），对应的节点
    *   每一个表达式都有对应的watcher对象
    *   当exp相关的属性（a.b.c中任意一个，注意必须是a的b，b的c）发生改变时，回调函数执行
    *
    * 指定用于更新节点的回调函数，
    * */
    new Watcher(vm, exp, function (value, oldValue) {
      updaterFn && updaterFn(node, value, oldValue);
    });
  },

  // 事件处理 exp指令属性值（也就是表达式），dir指令属性名
  eventHandler: function (node, vm, exp, dir) {
    //例，dir为on:click，则eventType为click
    var eventType = dir.split(':')[1],
      fn = vm.$options.methods && vm.$options.methods[exp];

    //为了确保
    if (eventType && fn) {
      //bind会返回新的函数
      node.addEventListener(eventType, fn.bind(vm), false);
    }
  },

  /*
  * 得到表达式对应的属性值
  *   遍历是因为，表达式可能是a.b.c这种格式的
  *   返回的 val中，属性值
  * */
  _getVMVal: function (vm, exp) {
    var val = vm._data;
    exp = exp.split('.');
    exp.forEach(function (k) {
      //根据vm._data中对应的属性名，层层获取，获取属性值
      val = val[k];
    });
    return val;
  },

  // 设置表达式所对应的属性的值
  _setVMVal: function (vm, exp, value) {
    var val = vm._data;
    exp = exp.split('.');
    exp.forEach(function (k, i) {
      // 非最后一个key，更新val的值
      if (i < exp.length - 1) {
        val = val[k];
      } else {
        val[k] = value;
      }
    });
  }
};


// 包含n个更新节点的方法的对象
var updater = {
  // 更新节点的textContent属性
  textUpdater: function (node, value) {
    node.textContent = typeof value == 'undefined' ? '' : value;
  },

  // 更新节点的inner属性
  htmlUpdater: function (node, value) {
    node.innerHTML = typeof value == 'undefined' ? '' : value;
  },

  /*
  * 更新节点的className属性，oldValue初始化时没有
  *   这里只是实现了v-class来模拟v-bind:class的作用
  * */
  classUpdater: function (node, value, oldValue) {
    var className = node.className;
    //每次的oldValue都要被去掉，因为只有新的class就可以了。
    className = className.replace(oldValue, '').replace(/\s$/, '');

    var space = className && String(value) ? ' ' : '';

    node.className = className + space + value;
  },

  // 更新节点的value属性，node就是input输入框
  modelUpdater: function (node, value, oldValue) {
    node.value = typeof value == 'undefined' ? '' : value;
  }
};