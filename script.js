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
        itemData: {
          translated: {},
          stack: {},
          durability: [],
          wrappingPaper: [],
          variants: {
            data: [],
            internal_names: [],
          },
        },
        search: {
          text: "",
          result: [],
          resultVariants: [],
          moreThan100: false,
        },
        itemVariants: {
          open: "",
          data: [],
          result: [],
        },
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
          wrappingPaper: {
            color: "", withName: false,
          },
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
      getBagPicture(item) {
        let color = item.wrappingPaper.color;
        if (color.length == 0) return "";
        if (color == 'festive') color = 'ornament';
        color = color.replace(/(?:^\w|[A-Z]|\b\w|\s+)/g, function (match, index) {
          if (+match === 0) return ""; // or if (/\s+/.test(match)) for white spaces
          return index === 0 ? match.toLowerCase() : match.toUpperCase();
        });
        return 'https://acnhcdn.com/latest/MenuIcon/WBag' + color.charAt(0).toUpperCase() + color.slice(1) + '.png';
      },
      getWrappingPaperName(option) {
        if (this.pref.language.selected.length > 0)
          return this.itemData.translated.STR_ItemName_80_Etc.find(i => i.internal_name == option.internal_name).name;
        else return option.color.replace(/\w\S*/g, txt => txt.charAt(0).toUpperCase() +
          txt.substr(1).toLowerCase());
      },
      calculateItemId(item, opt = {}) {
        let variantId = (opt && opt.variantId) ? opt.variantId : "",
          isDiy = (opt && opt.isDiy) ? opt.isDiy : false,
          command = (opt && opt.command) ? opt.command : "diy";
        if (isDiy && command == "diy") return [item.DiyRecipe[1]];

        let a = "0000", b = "0000", c = "0000", d = isDiy ? "16A2" : item.id[1];
        if (!!item.durability)
          a = (item.durability.max - item.durability.current).toString(16).toUpperCase().padStart(4, "0");

        if (isDiy) b = item.DiyRecipe[1];
        else if (!!item.stack) b = (item.stack.current - 1).toString(16).toUpperCase().padStart(4, "0");
        else if (variantId.length > 0) b = variantId.toString(16).toUpperCase().padStart(4, "0");

        if (item.wrappingPaper.color.length > 0) {
          let color = this.itemData.wrappingPaper.find(c => c.color == item.wrappingPaper.color);
          c = item.wrappingPaper.withName ? color.withName : color.hex;
        }
        return [a, b, c, d];
      },
      trimItemId(ids, withSpace = false) {
        if (!Array.isArray(ids)) return ids;
        let trimmed = ids.map(i => i.toString(16).toUpperCase().padStart(4, "0")).join("").replace(/\b0+/g, '');
        if (withSpace) return trimmed.replace(/\B(?=(\w{4})+(?!\w))/g, " ");
        else return trimmed;
      },
      addToSelected(item, opt = {}) {
        let variantId = (opt && opt.variantId) ? opt.variantId : "",
          isDiy = (opt && opt.isDiy) ? opt.isDiy : false,
          command = (opt && opt.command) ? opt.command : "diy";

        let ids = this.calculateItemId(item, { variantId, isDiy, command });
        if (isDiy && command == "diy") this.selected.diys.push(ids[0]);
        else this.selected.items.push(ids);
        this.saveToLocalStorage();
      },
      joinSelected(items) {
        return items.map(i => this.trimItemId(i)).join(" ");
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
        let pref = Object.assign({}, this.pref);
        delete pref.language;
        let obj = {
          itemPrefix: this.selected.itemPrefix,
          diyPrefix: this.selected.diyPrefix,
          splitBy: this.selected.splitBy,
          pref: pref,
          language: this.pref.language.selected,
          searchText: this.search.text,
          selectedItems: this.selected.items,
          selectedDiys: this.selected.diys,
        };
        localStorage.setItem("data", JSON.stringify(obj));
      },
      searchItems(text, language) {
        this.search.results = [];
        if (text.length > 0) {
          Object.entries(this.itemData.translated).forEach(([key, val]) => {
            if (this.search.results.length < 100)
              this.search.results.push(...val.filter(item => item.name.toLowerCase().includes(text.toLowerCase())));
          });
          this.search.moreThan100 = this.search.results.length > 100;
          if (this.search.results.length > 100)
            this.search.results = this.search.results.slice(0, 100);

          // processing
          this.search.results.forEach(r => {
            if (r.internal_name) {
              Object.values(this.itemData.stack).forEach(arr => { // adding stack data
                let i = arr.findIndex(x => x.internal_name == r.internal_name);
                if (i > -1)
                  r.stack = { current: arr[i].stack, max: arr[i].stack };
              });

              let toolIndex = this.itemData.durability.findIndex(tool => tool.internal_name == r.internal_name);
              if (toolIndex > -1) r.durability = {
                current: this.itemData.durability[toolIndex].durability,
                max: this.itemData.durability[toolIndex].durability
              };

              if (this.itemData.variants.internal_names.includes(r.internal_name)) {
                r.variants = this.itemData.variants.data.reduce((arr, v) => {
                  if (v.id == r.internal_name) {
                    v.variant_id_trimmed = v.variant_id.slice(v.variant_id.lastIndexOf("_") + 1);
                    arr.push(v);
                  }
                  return arr;
                }, []);
              }
            }
            r.wrappingPaper = Object.assign({}, this.pref.wrappingPaper);
          });
        }
        this.saveToLocalStorage();
      },
      readNhi(e) {
        let buf2hex = buffer => Array.prototype.map.call(new Uint8Array(buffer),
          x => ("00" + x.toString(16)).slice(-2).toUpperCase());
        const file = e.target.files[0],
          reader = new FileReader();
        reader.onload = e => {
          let buffer = e.target.result,
            hex = buf2hex(buffer);
          // ["AB", "CD", "12", "34", ...] -> ["CDAB", "3412", ...]
          hex = hex.reduce((r, e, i) => (i % 2 ? r[r.length - 1] = e + r[r.length - 1] : r.push(e)) && r, []);
          // ["1234", "5678", "9ABC", "DEF0", "1234", ...] -> [["1234", "5678", "9ABC", "DEF0"], ...]
          hex = hex.reduce((r, e, i) => (i % 4 ? r[r.length - 1].unshift(e) : r.push([e])) && r, []);
          hex = hex.filter(item => item[3] != "FFFE");
          this.selected.items = this.selected.items.concat(hex);
        }
        reader.readAsArrayBuffer(file);
      },
      saveNhi() {
        let emptyItem = ["0000", "0000", "0000", "FFFE"],
          data = this.selected.items.splice(0, 40);
        while (data.length < 40) { data.push(emptyItem); }

        let hexdata = data.reduce((hexstring, item) => {
          let array = Object.assign([], item);
          while (array.length > 0) {
            let h = array.pop();
            hexstring += h.slice(2) + h.slice(0, -2);
          }
          return hexstring;
        }, "");

        let byteArray = new Uint8Array(hexdata.length / 2);
        for (let x = 0; x < byteArray.length; x++)
          byteArray[x] = parseInt(hexdata.substr(x * 2, 2), 16);

        let blob = new Blob([byteArray], { type: "application/octet-stream" });
        const link = document.createElement("a"); // Create a link element

        // Set link's href to point to the Blob URL
        link.href = URL.createObjectURL(blob);
        link.download = "inventory.nhi";

        // Append link to the body
        document.body.appendChild(link);

        // Dispatch click event on the link
        // This is necessary as link.click() does not work on the latest firefox
        link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));

        // Remove link from body
        document.body.removeChild(link);
      },
    },
    created() {
      if (localStorage.getItem("data")) {
        let saved = JSON.parse(localStorage.getItem("data"));
        this.selected.itemPrefix = saved.itemPrefix || this.selected.itemPrefix;
        this.selected.diyPrefix = saved.diyPrefix || this.selected.diyPrefix;
        this.selected.splitBy = saved.splitBy || this.selected.splitBy;
        if (saved.pref) Object.entries(saved.pref).forEach(([key, val]) => this.pref[key] = val);
        this.pref.language.selected = saved.language || this.pref.language.selected;
        this.search.text = saved.searchText || this.search.text;
        this.selected.items = saved.selectedItems || this.selected.items;
        this.selected.diys = saved.selectedDiys || this.selected.diys;
      }
      else if (navigator.language == "zh-TW") this.pref.language.selected = "TWzh";

      fetch("./translation-sheet-data/variants.json")
        .then(response => response.json())
        .then(json => {
          this.itemVariants.data = json;
          this.itemData.variants.data = json;
          this.itemData.variants.internal_names = json.reduce((arr, r) => {
            if (!arr.includes(r.id)) arr.push(r.id);
            return arr;
          }, []);
        });

      fetch("./data/durability.json")
        .then(response => response.json())
        .then(json => this.itemData.durability = json);

      fetch("./data/stack.json")
        .then(response => response.json())
        .then(json => this.itemData.stack = json);

      fetch("./data/wrapping paper.json")
        .then(response => response.json())
        .then(json => this.itemData.wrappingPaper = json);

      window.onclick = event => {
        if (event.target == this.$refs['variant-selector']) {
          this.itemVariants.open = "";
        }
      };
    },
    watch: {
      async "pref.language.selected"(to) {
        let json = await fetch("./ACNH/item_ids/items_" + this.pref.language.selected + ".json")
          .then(response => response.json());
        this.itemData.translated = json;
        if (this.search.text.length > 0) this.searchItems(this.search.text);
        this.saveToLocalStorage();
      },
      "search.text"(to) {
        this.searchItems(to);
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
        this.saveToLocalStorage();
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
