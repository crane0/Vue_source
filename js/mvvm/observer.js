function Observer(data) {
    this.data = data;
    //开始执行，走起！
    this.walk(data);
}

Observer.prototype = {
    walk: function(data) {
        //this是 Observer的实例
        var me = this;
        //遍历data中外层的所有属性
        Object.keys(data).forEach(function(key) {
            //转换
            me.convert(key, data[key]);
        });
    },
    convert: function(key, val) {
        //对指定的属性，进行数据劫持
        this.defineReactive(this.data, key, val);
    },

    /*
    * 定义一个响应式的属性，
    *   也就是说，进行数据的劫持，数据改变，我能发现，做出对应的改变更新页面
    * 每一个data中的属性，都会执行这个方法，也就是数据劫持对应的数据
    *
    * */
    defineReactive: function(data, key, val) {
        /*
        * data中所有层次的属性个数，和dep对象的个数相同
        *   也就是说，和属性时一一对应的
        *
        * 当执行这个时，是为了创建一个容器，放watcher
        *   此时watcher还没有创建！
        * */
        var dep = new Dep();
        /*
        * val就是key的属性值，先遍历data的直接属性，再遍历data对应属性的属性
        * 这是一个隐式递归，对所有层次的属性，进行监视
        * */
        var childObj = observe(val);

        /*
        * （使用这样的方式，比一般定义的方式，有get和set方法）
        * 实现数据劫持
        *   给data--重新定义--一个属性
        *   因为添加了set方法，所以就对key属性，进行了监视
        * */
        Object.defineProperty(data, key, {
            enumerable: true, // 可枚举
            configurable: false, // 不能再define
            /*
            * 用于建立关系，因为第一次watcher还没有创建，所以执行第二次时，有watcher后，建立。
            *   触发：1，在compile中，170行，180行触发，180行真正有效。
            * */
            get: function() {
                //如果对应的watcher存在
                if (Dep.target) {
                    //建立dep与watcher之间的关系
                    dep.depend();
                }
                //返回属性值
                return val;
            },
          /*
          * 当key（data中当前属性值）发生变化时，调用set
          * */
            set: function(newVal) {
                if (newVal === val) {
                    return;
                }
                //保存最新值
                val = newVal;
                /*
                * 新的值是object的话，进行监听
                *   是否是对象，在observe()中会有判断
                * */
                childObj = observe(newVal);
                // 通知dep，由dep通知订阅者
                dep.notify();
            }
        });
    }
};

/*
* 从mvvm.js中，进入的
* 监视对象内部的数据，所以必须保证是个对象
*   每一个对象，都会有一个observer
* */
function observe(value, vm) {
    if (!value || typeof value !== 'object') {
        return;
    }

    return new Observer(value);
};


var uid = 0;

function Dep() {
    //每创建一个新的dep，都会有一个id
    this.id = uid++;
    /*
    * subscribe的简写，其实就是 watchers，
    *   数组放相关 watcher对应的表达式（用到当前属性的表达式）
    *   目前来看，dep:watchers  1:n
    *   如果有多个表达式用到同一个属性，数组中就会有多个watcher！
    * */
    this.subs = [];
}

Dep.prototype = {
    addSub: function(sub) {
        this.subs.push(sub);
    },

    depend: function() {
        Dep.target.addDep(this);
    },

    removeSub: function(sub) {
        var index = this.subs.indexOf(sub);
        if (index != -1) {
            this.subs.splice(index, 1);
        }
    },

    //遍历所有的watcher
    notify: function() {
        this.subs.forEach(function(sub) {
            //进入watcher中的update
            sub.update();
        });
    }
};

Dep.target = null;