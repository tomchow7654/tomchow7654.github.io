const { ref, computed, reactive, onMounted, watch, watchEffect, nextTick } = Vue;
const { throttledWatch, debouncedWatch, useMagicKeys, useKeyModifier, templateRef, whenever, useActiveElement, and,
  useRefHistory, useLocalStorage } = VueUse;

let useHexUtil = ({ data, pref, selected }) => {
  let hexUtil = {
    otherInformation(item) {
      if (item.internal_name && item.internal_name.includes("Fake")) return " (Fake)";
      else if (item.color) return " (" + item.color + ")";
      return "";
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

      if (item.wrappingPaper.color.length > 0 && !!data.wrappingPaper) {
        let color = data.wrappingPaper.find(paper => paper.color == item.wrappingPaper.color);
        if (color) c = item.wrappingPaper.withName ? color.withName : color.hex;
      }
      return [a, b, c, d];
    },
    trimItemId(ids, withSpace = false) {
      if (!Array.isArray(ids)) return ids;
      let trimmed = ids.map(i => i.toString(16).toUpperCase().padStart(4, "0")).join("").replace(/\b0+/g, '');
      if (withSpace) return trimmed.replace(/\B(?=(\w{4})+(?!\w))/g, " ");
      else return trimmed;
    },
    injectItemData(results) {
      return results.map(r => {
        if (r.internal_name) {
          // adding stack data
          let stackInfo = data.stack.find(x => x.internal_id == r.id[0]);
          if (stackInfo && stackInfo.stack > 1)
            r.stack = { current: stackInfo.stack, max: stackInfo.stack };

          let toolIndex = data.durability.findIndex(tool => tool.internal_name == r.internal_name);
          if (toolIndex > -1) r.durability = {
            current: data.durability[toolIndex].durability,
            max: data.durability[toolIndex].durability
          };

          if (data.variants.internal_names.includes(r.internal_name)) {
            r.variants = data.variants.data.reduce((arr, v) => {
              if (v.id == r.internal_name) {
                v.variant_id_trimmed = v.variant_id.slice(v.variant_id.lastIndexOf("_") + 1);
                arr.push(v);
              }
              return arr;
            }, []);
          }
        }
        r.wrappingPaper = Object.assign({}, pref.value.wrappingPaper);
        return r;
      });
    },
    nhi: {
      import(e) {
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
          selected.value.items = selected.value.items.concat(hex);
        }
        reader.readAsArrayBuffer(file);
      },
      export() {
        let emptyItem = ["0000", "0000", "0000", "FFFE"],
          data = selected.value.items.splice(0, 40);
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

        let date = new Date(), offset = date.getTimezoneOffset();
        date = new Date(date.getTime() - (offset * 60 * 1000))

        // Set link's href to point to the Blob URL
        link.href = URL.createObjectURL(blob);
        link.download = date.toISOString().replace(/-|:/g, "").replace(/T/g, "_").slice(0, -5) + ".nhi";

        // Append link to the body
        document.body.appendChild(link);

        // Dispatch click event on the link
        // This is necessary as link.click() does not work on the latest firefox
        link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));

        // Remove link from body
        document.body.removeChild(link);
      },
    },
  };
  return hexUtil;
};

let useCopyUtil = () => {
  let copyUtil = { copyText: ref("") };
  watch(() => copyUtil.copyText.value, (to) => {
    if (to.length > 0) setTimeout(() => { if (copyUtil.copyText.value == to) copyUtil.copyText.value = "" }, 3000);
  });

  copyUtil.copy = async text => {
    try {
      copyUtil.copyText.value = text;
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error('Failed to copy: ', err);
    }
  };
  return copyUtil;
};

let app = {
  setup(props) {
    let pref = useLocalStorage("pref", {
      language: "", showToast: false, wrappingPaper: { color: "", withName: false }, preventAlt: true,
      item: { diySeparateCmd: false, itemPrefix: "", diyPrefix: "", splitBy: 5 }
    }), data = reactive({}), search = reactive({}), selected = ref({ items: [], diys: [] }),
      loading = reactive({ language: true, variants: true, stack: true, durability: true, wrappingPaper: true }),
      hexUtil = useHexUtil({ data, pref, selected }),
      copyUtil = useCopyUtil();
    Object.assign(data, {
      translation: {},
      variants: { data: [], internal_names: [] },
      stack: {},
      durability: [],
      wrappingPaper: [],
    });
    let fetchJSON = async path => await fetch(path).then(resp => resp.json());
    fetchJSON("./translation-sheet-data/variants.json").then(json => {
      data.variants.data = json;
      data.variants.internal_names = json.reduce((arr, r) => {
        if (!arr.includes(r.id)) arr.push(r.id);
        return arr;
      }, []);
      loading.variants = false;
    });
    fetchJSON("./data/durability.json").then(json => { data.durability = json; loading.durability = false; });
    fetchJSON("./data/stack.json").then(json => { data.stack = json; loading.stack = false; });
    fetchJSON("./data/wrapping paper.json").then(json => { data.wrappingPaper = json; loading.wrappingPaper = false; });

    data.getWrappingPaperName = internal_name => {
      let name = "";
      if (pref.value.language.length > 0 && !loading.any) {
        var list = data.translation[pref.value.language].etcInternalNames;
        if (list.has(internal_name)) name = list.get(internal_name).name;
      }
      return name;
    };

    data.getBagPicture = item => {
      let color = item.wrappingPaper.color;
      if (color.length == 0) return "";
      if (color == 'festive') color = 'ornament';
      color = color.replace(/(?:^\w|[A-Z]|\b\w|\s+)/g, function (match, index) {
        if (+match === 0) return ""; // or if (/\s+/.test(match)) for white spaces
        return index === 0 ? match.toLowerCase() : match.toUpperCase();
      });
      return 'https://acnhcdn.com/latest/MenuIcon/WBag' + color.charAt(0).toUpperCase() + color.slice(1) + '.png';
    };

    const languages = reactive([
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
    ]);
    debouncedWatch(() => pref.value.language, async to => {
      if (!(to in data.translation)) {
        loading.language = true;
        let json = await fetch("./ACNH/item_ids/items_" + to + ".json").then(response => response.json());
        let byName = new Map(), byId = new Map(), diyIds = new Map(), etcInternalNames = new Map();
        Object.entries(json).forEach(([key, val]) => {
          val.forEach(item => {
            byId.set(item.id[1], item);
            byName.set(item.id[1], item.name);
            if (item.DiyRecipe) diyIds.set(item.DiyRecipe[1], item.id[1]);
            if (key == "STR_ItemName_80_Etc") etcInternalNames.set(item.internal_name, item);
          });
        });
        data.translation[to] = { raw: json, byName, byId, diyIds, etcInternalNames };
        loading.language = false;
      }
      // if (search.text.length > 0) searchItems(search.text);
    }, { debounce: 500, immediate: true });
    loading.any = computed(() => loading.language || loading.variants || loading.durability
      || loading.stack || loading.wrappingPaper);

    watch(() => [pref.value.showToast, Math.ceil(selected.value.items.length / pref.value.item.splitBy),
    Math.ceil(selected.value.diys.length / pref.value.item.splitBy)], (to, from) => {
      if (to.some((v, i) => v != from[i]))
        nextTick().then(r => {
          let toastElList = [].slice.call(document.querySelectorAll('.toast')),
            toastList = toastElList.map(toastEl => new bootstrap.Toast(toastEl, { autohide: false }));
          toastList.forEach(t => t[to[0] ? "show" : "hide"]());
        });
    });

    Object.assign(search, {
      text: "",
      result: [],
      moreThan100: false,
    });
    search.byName = (name, language) => {
      let result = [], moreThan100 = false;
      if (!language) language = pref.value.language;
      if (name.length > 0) {
        let names = Array.from(data.translation[language].byName.entries()),
          found = names.filter(([key, val]) => val.toLowerCase().includes(name.toLowerCase()));
        if (found.length > 100) {
          moreThan100 = true;
          found = found.slice(0, 100);
        }
        result = found.map(([key, val]) => data.translation[language].byId.get(key));
      }
      return { result, moreThan100 };
    };
    search.byId = (id, language) => {
      if (!language) language = pref.value.language;
      if (id.length == 4) return data.translation[language].byId.get(id);
      else return null;
    };
    debouncedWatch(() => search.text, to => {
      if (pref.value.language.length > 0 && !loading.language) {
        let r = search.byName(to);
        search.result = hexUtil.injectItemData(r.result);
        search.moreThan100 = r.moreThan100;
      }
      nextTick().then(() => {
        var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'))
        var tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
          return new bootstrap.Tooltip(tooltipTriggerEl)
        })
      });
    }, { debounce: 500 });

    const { undo, redo, canUndo, canRedo } = useRefHistory(selected, { deep: true, capacity: 15 });
    let selection = {
      add(item, opt = {}) {
        let variantId = (opt && opt.variantId) ? opt.variantId : "",
          isDiy = (opt && opt.isDiy) ? opt.isDiy : false,
          command = (opt && opt.command) ? opt.command : "diy";

        let ids = hexUtil.calculateItemId(item, { variantId, isDiy, command });
        if (isDiy && command == "diy") selected.value.diys.push(ids[0]);
        else selected.value.items.push(ids);
        if (!isDiy && !this.history.some(x => x.length == ids.length && x.every((v, i) => v === ids[i]))) {
          this.history.unshift(ids);
          if (this.history.length > 5) this.history.splice(5);
        };
      },
      addHex(ids) {
        selected.value.items.push(ids);
        if (!this.history.some(x => x.length == ids.length && x.every((v, i) => v === ids[i]))) {
          this.history.unshift(ids);
          if (this.history.length > 5) this.history.splice(5);
        };
      },
      history: reactive([]),
      undo, redo, canUndo: ref(canUndo), canRedo: ref(canRedo),
      join(items) {
        return items.map(i => hexUtil.trimItemId(i)).join(" ");
      },
      splited: reactive({
        items: computed(() => {
          var i, j, splited = [];
          for (i = 0, j = selected.value.items.length; i < j; i += pref.value.item.splitBy)
            splited.push(selected.value.items.slice(i, i + pref.value.item.splitBy));
          return splited;
        }),
        diys: computed(() => {
          var i, j, splited = [];
          for (i = 0, j = selected.value.diys.length; i < j; i += pref.value.item.splitBy)
            splited.push(selected.value.diys.slice(i, i + pref.value.item.splitBy));
          return splited;
        })
      })
    };
    let cache = JSON.parse(localStorage.getItem("search-cache"));
    if (cache) {
      if (cache.text) search.text = cache.text;
      if (cache.result) search.result = cache.result;
      if (cache.history) selection.history.push(...cache.history);
      if (cache.selected) {
        if (cache.selected.items.length > 0) selected.value.items.push(...cache.selected.items);
        if (cache.selected.diys.length > 0) selected.value.diys.push(...cache.selected.diys);
      }
      nextTick().then(() => {
        var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'))
        var tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
          return new bootstrap.Tooltip(tooltipTriggerEl)
        })
      });
    }
    throttledWatch(() => ({
      text: search.text, history: selection.history, result: search.result, selected: {
        items: selected.value.items, diys: selected.value.diys
      }
    }), to => {
      localStorage.setItem("search-cache", JSON.stringify(to));
    }, { throttle: 500, deep: true });

    const title = computed(() => {
      let titles = {
        default: 'ACNH item id lookup',
        TWzh: "動森物品ID 尋找",
      };
      let title = titles.default;
      if (pref.value.language.length > 0 && titles[pref.value.language]) title = titles[pref.value.language];
      return title;
    });
    const keys = useMagicKeys({
      passive: false, onEventFired(e) {
        if (["/"].includes(e.key)) e.preventDefault();
        else if (e.key === "Alt" && pref.value.preventAlt && search.result.length > 0) e.preventDefault();
        else if (e.altKey && e.key === "D" && selected.value.items.length > 0) e.preventDefault();
      },
    }), searchBox = templateRef("search-box");
    whenever(keys.slash, () => {
      let box = searchBox.value;
      box.focus(); box.scrollIntoView({ behavior: "smooth", block: "end", inline: "nearest" });
    });
    const activeElement = useActiveElement()
    const notUsingInput = computed(() => !["INPUT", "TEXTAREA"].includes(activeElement.value.tagName));
    watchEffect(() => {
      for (let i = 1; i <= 9; i++)
        if (keys["Alt+" + i].value && search.result[i - 1])
          selection.add(search.result[i - 1]);
      if (keys["Alt+C"].value) {
        let itemPref = pref.value.item;
        copyUtil.copy(itemPref.itemPrefix + ' ' + selection.join(selection.splited.items[0]))
          .then(() => selected.value.items.splice(0, itemPref.splitBy));
      } else if (keys["Alt+D"].value && selected.value.items.length > 0) hexUtil.nhi.export();
      else if (!notUsingInput.value && keys.escape.value) {
        let box = searchBox.value;
        box.blur();
      }
      else if (notUsingInput.value) {
        if (keys["Ctrl+Z"].value) selection.undo();
        else if (keys["Ctrl+Y"].value || keys["Ctrl+Shift+Z"].value) selection.redo();
      }
    });
    const altState = useKeyModifier("Alt");
    const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });
    return { title, loading, search, selected, selection, pref, data, languages, ...hexUtil, ...copyUtil, altState, scrollToTop };
  },
};
Vue.createApp(app).mount('#app');

export default app;