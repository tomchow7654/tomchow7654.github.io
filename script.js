/* globals Chart:false, feather:false */

(function () {
  'use strict'

  let app = {
    data() {
      return {
        titles: {
          default: 'ACNH item id lookup',
          TWzh: "動森物品ID 尋找",
        },
        itemData: {},
        itemVariants: {
          open: "",
          data: [],
          result: [],
        },
        results: [],
        search: "",
        copyText: "",
        selected: {
          itemPrefix: "",
          items: [],
          diyPrefix: "",
          diys: [],
          splitBy: 5,
        },
        toastList: [],
        pref: {
          diySeparateCmd: true,
          showToast: true,
          language: {
            selected: "",
            options: [
              { text: "Deutsch", value: "EUde" },
              { text: "English", value: "USen" },
              { text: "English (UK)", value: "EUen" },
              { text: "Español", value: "EUes" },
              { text: "Español (US)", value: "USes" },
              { text: "Français", value: "EUfr" },
              { text: "Français (CA)", value: "USfr" },
              { text: "Italiano", value: "EUit" },
              { text: "Nederlands", value: "EUnl" },
              { text: "Русский", value: "EUru" },
              { text: "中文(繁體)", value: "TWzh" },
              { text: "中文(簡體)", value: "CNzh" },
              { text: "日本語", value: "JPja" },
              { text: "한국어", value: "KRko" },
            ],
          },
        },
      }
    },
    computed: {
      title() {
        let title = this.titles.default;
        if (this.pref.language.selected.length > 0 && this.titles[this.pref.language.selected])
          title = this.titles[this.pref.language.selected];

        return title;
      },
      splitedItems() {
        var i, j, splited = [];
        for (i = 0, j = this.selected.items.length; i < j; i += this.selected.splitBy)
          splited.push(this.selected.items.slice(i, i + this.selected.splitBy));
        return splited;
      },
      splitedDiys() {
        var i, j, splited = [];
        for (i = 0, j = this.selected.diys.length; i < j; i += this.selected.splitBy)
          splited.push(this.selected.diys.slice(i, i + this.selected.splitBy));
        return splited;
      },
      openedVariant() {
        let v = this.itemVariants.data.filter(x => x.id == this.itemVariants.open.internal_name);
        v.forEach(x => x.variant_id_calculated = this.itemVariantId(this.itemVariants.open.id[1],
          x.variant_id.slice(x.variant_id.lastIndexOf("_") + 1)));
        return v;
      },
    },
    methods: {
      variant(item) {
        if (item.internal_name && item.internal_name.includes("Fake")) return " (Fake)";
        else if (item.color) return " (" + item.color + ")";
        return "";
      },
      async copy(text, toast) {
        this.copyText = text;
        await this.$nextTick();
        let copyBox = this.$refs.copyBox;
        copyBox.select();
        document.execCommand("copy");
        // copied
        copyBox.blur();
      },
      itemVariantId(itemId, variantId) {
        if (variantId == 0) return itemId;
        else return "0000" + variantId.toString(16).toUpperCase().padStart(4, "0") + "0000" + itemId;
      },
      diyToDropCmd(diyId) {
        return diyId + "0000" + "16A2";
      },
      addToSelected(item, type = "item") {
        if (type == "item") {
          this.selected.items.push(item.id[1])
        }
        else if (type == "diy") {
          this.selected.diys.push(item.DiyRecipe[1]);
        }
        else {
          this.selected.items.push(this.diyToDropCmd(item.DiyRecipe[1]));
        }
      },
      showAllToast() {
        if (this.pref.showToast)
          this.$nextTick().then(r => {
            let toastElList = [].slice.call(document.querySelectorAll('.toast'));
            this.toastList = toastElList.map(function (toastEl) {
              return new bootstrap.Toast(toastEl, { autohide: false });
            });

            this.toastList.forEach(t => t.show());
          });
      },
      saveToLocalStorage() {
        let obj = {
          itemPrefix: this.selected.itemPrefix,
          diyPrefix: this.selected.diyPrefix,
          splitBy: this.selected.splitBy,
          language: this.pref.language.selected,
          searchText: this.search,
        };
        localStorage.setItem("data", JSON.stringify(obj));
      },
    },
    created() {
      if (localStorage.getItem("data")) {
        let saved = JSON.parse(localStorage.getItem("data"));
        this.selected.itemPrefix = saved.itemPrefix;
        this.selected.diyPrefix = saved.diyPrefix;
        this.selected.splitBy = saved.splitBy;
        this.pref.language.selected = saved.language;
        this.search = saved.searchText;
      }
      else if (navigator.language == "zh-TW") this.pref.language.selected = "TWzh";

      fetch("./translation-sheet-data/variants.json")
        .then(response => response.json())
        .then(json => this.itemVariants.data = json);

      window.onclick = event => {
        if (event.target == this.$refs['variant-selector']) {
          this.itemVariants.open = "";
        }
      };
    },
    watch: {
      "pref.language.selected"(to) {
        fetch("./ACNH/item_ids/items_" + this.pref.language.selected + ".json")
          .then(response => response.json())
          .then(json => this.itemData = json);
        this.saveToLocalStorage();
      },
      search(to) {
        this.results = [];

        if (to.length > 0) {
          Object.entries(this.itemData).forEach(([key, val]) => {
            this.results.push(...val.filter(item => item.name.toLowerCase().includes(to.toLowerCase())));
          });
          let internal_names = this.results.reduce((arr, r) => {
            if (r.internal_name) arr.push(r.internal_name);
            return arr;
          }, []);

          this.itemVariants.result = this.itemVariants.data.reduce((arr, v) => {
            if (internal_names.includes(v.id)) arr.push(v.id);
            return arr;
          }, []);
        }
        this.saveToLocalStorage();
      },
      copyText(to) {
        if (to.length > 0) {
          setTimeout(() => { if (this.copyText == to) this.copyText = "" }, 3000);
        }
      },
      "pref.showToast"(to) {
        this.$nextTick().then(r => {
          let toastElList = [].slice.call(document.querySelectorAll('.toast'));
          this.toastList = toastElList.map(function (toastEl) {
            return new bootstrap.Toast(toastEl, { autohide: false });
          });

          this.toastList.forEach(t => {
            if (to)
              t.show();
            else
              t.hide();
          });
        });
      },
      "selected.items.length"(to) {
        this.showAllToast();
      },
      "selected.diys.length"(to) {
        this.showAllToast();
      },
      "selected.itemPrefix"(to) {
        this.saveToLocalStorage();
      },
      "selected.diyPrefix"(to) {
        this.saveToLocalStorage();
      },
      "selected.splitBy"(to) {
        this.saveToLocalStorage();
      },
    },
  };
  Vue.createApp(app).mount('#app');
})()
