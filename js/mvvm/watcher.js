function Watcher(vm, exp, cb) {
    /*
    * 回调函数，对应的compile中179行左右，new Watcher()中传递的回调函数
    *   用于更新节点
    * */
    this.cb = cb;
    this.vm = vm;
    this.exp = exp;
    this.depIds = {};   //watcher用于保存相关dep的对象容器，属性名是dep.id(作为唯一标识)
    this.value = this.get();    //表达式对应的初始值
}

Watcher.prototype = {
    update: function() {
        this.run();
    },
    run: function() {
        var value = this.get();
        var oldVal = this.value;
        //新旧值对比
        if (value !== oldVal) {
            //保存新的值
            this.value = value;
            /*
            * 调用用于更新的回调函数，
            * call首先是执行（让vm执行），当执行完compile中179行左右，new Watcher()的调用，页面就会发生变化！
            * */
            this.cb.call(this.vm, value, oldVal);
        }
    },
    addDep: function(dep) {
        // 1. 每次调用run()的时候会触发相应属性的getter
        // getter里面会触发dep.depend()，继而触发这里的addDep
        // 2. 假如相应属性的dep.id已经在当前watcher的depIds里，说明不是一个新的属性，仅仅是改变了其值而已
        // 则不需要将当前watcher添加到该属性的dep里
        // 3. 假如相应属性是新的属性，则将当前watcher添加到新属性的dep里
        // 如通过 vm.child = {name: 'a'} 改变了 child.name 的值，child.name 就是个新属性
        // 则需要将当前watcher(child.name)加入到新的 child.name 的dep里
        // 因为此时 child.name 是个新值，之前的 setter、dep 都已经失效，如果不把 watcher 加入到新的 child.name 的dep中
        // 通过 child.name = xxx 赋值的时候，对应的 watcher 就收不到通知，等于失效了
        // 4. 每个子属性的watcher在添加到子属性的dep的同时，也会添加到父属性的dep
        // 监听子属性的同时监听父属性的变更，这样，父属性改变时，子属性的watcher也能收到通知进行update
        // 这一步是在 this.get() --> this.getVMVal() 里面完成，forEach时会从父级开始取值，间接调用了它的getter
        // 触发了addDep(), 在整个forEach过程，当前wacher都会加入到每个父级过程属性的dep
        // 例如：当前watcher的是'child.child.name', 那么child, child.child, child.child.name这三个属性的dep都会加入当前watcher


        /*
        * depIds是对象，dep.id作为属性名，dep是属性值
        *
        * 在这里建立watcher与dep之间的关系！！！
        *   做判断，是为了看之前有没有建立过联系，避免建立多次
        *   用对象，是为了更高效的找到dep.id
        * */
        if (!this.depIds.hasOwnProperty(dep.id)) {
            //建立从dep到watcher，因为这样就可以从dep找到watcher
            dep.addSub(this);
            //相反，this是watchers
            this.depIds[dep.id] = dep;
        }
    },
    get: function() {
        //给dep指定当前watcher为其target
        Dep.target = this;
        //得到当前表达式对应的属性值，内部会导致get调用，从而建立dep和watcher之间的关系
        var value = this.getVMVal();
        //去掉dep中关联的当前watcher，为了保证要先建立watcher
        Dep.target = null;
        return value;
    },

    //取表达式对应的值
    getVMVal: function() {
        var exp = this.exp.split('.');
        var val = this.vm._data;
        exp.forEach(function(k) {
            val = val[k];
        });
        return val;
    }
};