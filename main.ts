import { App, ColorComponent, Plugin, PluginSettingTab, Setting, SettingDefinitionItem, normalizePath, Notice, MarkdownView, TFile } from "obsidian";

interface SnapSlidesSettings {
  enableStyling: boolean;
  outputFolder: string;
  baseFontSize: string;
  h1FontSize: string;
  h2FontSize: string;
  slidePadding: string;
  headingMarginTop: string;
  accentColor: string;
  scrollableSlides: boolean;
  h1Color: string;
  h2Color: string;
  h3Color: string;
  h4Color: string;
  h5Color: string;
  h6Color: string;
  enableMobileStyling: boolean;
  mobileFontSizeVertical: string;
  mobileFontSizeHorizontal: string;
  mobileScrollableSlides: boolean;
  centerMobileVertically: boolean;
}

type BooleanSettingKey = {
  [Key in keyof SnapSlidesSettings]: SnapSlidesSettings[Key] extends boolean ? Key : never;
}[keyof SnapSlidesSettings];

type StringSettingKey = Exclude<keyof SnapSlidesSettings, BooleanSettingKey>;

const BOOLEAN_SETTING_KEYS: ReadonlySet<string> = new Set([
  "enableStyling",
  "scrollableSlides",
  "enableMobileStyling",
  "mobileScrollableSlides",
  "centerMobileVertically"
] satisfies BooleanSettingKey[]);

const STRING_SETTING_KEYS: ReadonlySet<string> = new Set([
  "outputFolder",
  "baseFontSize",
  "h1FontSize",
  "h2FontSize",
  "slidePadding",
  "headingMarginTop",
  "accentColor",
  "h1Color",
  "h2Color",
  "h3Color",
  "h4Color",
  "h5Color",
  "h6Color",
  "mobileFontSizeVertical",
  "mobileFontSizeHorizontal"
] satisfies StringSettingKey[]);

function isBooleanSettingKey(key: string): key is BooleanSettingKey {
  return BOOLEAN_SETTING_KEYS.has(key);
}

function isStringSettingKey(key: string): key is StringSettingKey {
  return STRING_SETTING_KEYS.has(key);
}

const DEFAULT_ACCENT_COLOR = "#A2CF80";
const OBSIDIAN_ACCENT_COLOR = "var(--interactive-accent, var(--color-accent, #A2CF80))";

function getObsidianAccentColor(): string {
  const probe = document.body.createSpan();
  probe.style.color = OBSIDIAN_ACCENT_COLOR;

  let computedColor: string;
  try {
    computedColor = getComputedStyle(probe).color;
  } finally {
    probe.remove();
  }

  const rgb = computedColor.match(/^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
  if (!rgb) {
    return DEFAULT_ACCENT_COLOR;
  }

  return `#${rgb.slice(1, 4).map(channel => Number(channel).toString(16).padStart(2, "0")).join("")}`;
}

const DEFAULT_SETTINGS: SnapSlidesSettings = {
  enableStyling: true,
  outputFolder: "",
  baseFontSize: "1.6em",
  h1FontSize: "2em",
  h2FontSize: "1.4em",
  slidePadding: "3vw",
  headingMarginTop: "2.5em",
  accentColor: "",
  scrollableSlides: true,
  h1Color: "#A2CF80",
  h2Color: "#FFD700",
  h3Color: "#FF8C00",
  h4Color: "#1E90FF",
  h5Color: "#BA55D3",
  h6Color: "#FF69B4",
  enableMobileStyling: true,
  mobileFontSizeVertical: "4vw",
  mobileFontSizeHorizontal: "3vw",
  mobileScrollableSlides: true,
  centerMobileVertically: false
};

function updateCssSettings(settings: SnapSlidesSettings) {
  document.body.style.setProperty(
    "--snap-slides-accent-color",
    settings.accentColor || OBSIDIAN_ACCENT_COLOR
  );
  document.documentElement.setCssProps({
    "--snap-slides-h1-color": settings.h1Color,
    "--snap-slides-h2-color": settings.h2Color,
    "--snap-slides-h3-color": settings.h3Color,
    "--snap-slides-h4-color": settings.h4Color,
    "--snap-slides-h5-color": settings.h5Color,
    "--snap-slides-h6-color": settings.h6Color,
    "--snap-slides-base-font-size": settings.baseFontSize,
    "--snap-slides-h1-font-size": settings.h1FontSize,
    "--snap-slides-h2-font-size": settings.h2FontSize,
    "--snap-slides-padding": settings.slidePadding,
    "--snap-slides-heading-margin-top": settings.headingMarginTop,
    "--snap-slides-mobile-font-size-portrait": settings.mobileFontSizeVertical,
    "--snap-slides-mobile-font-size-landscape": settings.mobileFontSizeHorizontal
  });
  document.documentElement.toggleClass("snap-slides-styling-enabled", settings.enableStyling);
  document.documentElement.toggleClass("snap-slides-mobile-enabled", settings.enableMobileStyling);
  document.documentElement.toggleClass("snap-slides-scrollable", settings.scrollableSlides);
  document.documentElement.toggleClass("snap-slides-mobile-scrollable", settings.mobileScrollableSlides);
  document.documentElement.toggleClass("snap-slides-center-mobile", settings.centerMobileVertically);
}

function clearCssSettings() {
  const root = document.documentElement;
  document.body.style.removeProperty("--snap-slides-accent-color");
  root.removeClasses([
    "snap-slides-styling-enabled",
    "snap-slides-mobile-enabled",
    "snap-slides-scrollable",
    "snap-slides-mobile-scrollable",
    "snap-slides-center-mobile",
    "snap-slides-close-button-idle"
  ]);
  [
    "--snap-slides-h1-color",
    "--snap-slides-h2-color",
    "--snap-slides-h3-color",
    "--snap-slides-h4-color",
    "--snap-slides-h5-color",
    "--snap-slides-h6-color",
    "--snap-slides-base-font-size",
    "--snap-slides-h1-font-size",
    "--snap-slides-h2-font-size",
    "--snap-slides-padding",
    "--snap-slides-heading-margin-top",
    "--snap-slides-mobile-font-size-portrait",
    "--snap-slides-mobile-font-size-landscape"
  ].forEach(property => root.style.removeProperty(property));
}

export default class SnapSlidesPlugin extends Plugin {
  settings!: SnapSlidesSettings;
  private closeButtonIdleTimeout: number | null = null;

  async onload() {
    await this.loadSettings();
    updateCssSettings(this.settings);
    const resetCloseButtonIdleTimer = () => this.resetCloseButtonIdleTimer();
    this.registerDomEvent(document, "pointermove", resetCloseButtonIdleTimer);
    this.registerDomEvent(document, "pointerdown", resetCloseButtonIdleTimer);
    this.registerDomEvent(document, "touchstart", resetCloseButtonIdleTimer, { passive: true });
    this.registerDomEvent(document, "wheel", resetCloseButtonIdleTimer, { passive: true });
    this.registerDomEvent(document, "scroll", resetCloseButtonIdleTimer, true);
    this.registerDomEvent(document, "keydown", resetCloseButtonIdleTimer);
    this.resetCloseButtonIdleTimer();

    this.addCommand({
      id: 'create-slide-note',
      name: 'Create slide copy for presentation',
      editorCallback: async (editor, view) => {
        if (!(view instanceof MarkdownView)) {
          new Notice("No active Markdown file.");
          return;
        }
        const file = view.file;
        let md = view.getViewData();

        // Remove YAML frontmatter
        md = md.replace(/^---\n[\s\S]+?\n---\n?/m, "");
        // Insert slide breaks before H1/H2 (except the first)
        const lines = md.split('\n');
        const out: string[] = [];
        let firstHeading = true;
        for (const line of lines) {
          if (/^(#|##) /.test(line)) {
            if (!firstHeading) out.push('---');
            firstHeading = false;
          }
          out.push(line);
        }
        const processed = out.join('\n');

        let folder = this.settings.outputFolder.trim();
        if (!file) {
          new Notice("No file context found.");
          return;
        }
        const originalBase = file.basename.replace(/[/\\?%*:|"<>]/g, "_");
        let newFilename = `${originalBase} Slides.md`;
        if (folder) {
          folder = normalizePath(folder);
          await this.app.vault.createFolder(folder).catch(() => {});
          newFilename = folder + "/" + newFilename;
        }
        let uniqueFilename = newFilename;
        let counter = 2;
        while (this.app.vault.getAbstractFileByPath(uniqueFilename)) {
          uniqueFilename = newFilename.replace(/\.md$/, ` ${counter}.md`);
          counter++;
        }
        const newFile = await this.app.vault.create(uniqueFilename, processed);
        if (newFile instanceof TFile) {
          await this.app.workspace.getLeaf(true).openFile(newFile);
          new Notice(`Slide copy created: ${uniqueFilename}`);
        } else {
          new Notice("Could not open the file. It may be a folder or an unsupported type.");
        }
      }
    });

    this.addSettingTab(new SnapSlidesSettingTab(this.app, this));
  }

  async loadSettings() {
    const savedData: unknown = await this.loadData();
    const savedSettings: Partial<SnapSlidesSettings> =
      typeof savedData === "object" && savedData !== null && !Array.isArray(savedData)
        ? { ...(savedData as Partial<SnapSlidesSettings>) }
        : {};
    const migrateLegacyAccent =
      typeof savedSettings.accentColor === "string" &&
      savedSettings.accentColor.toUpperCase() === DEFAULT_ACCENT_COLOR;
    if (migrateLegacyAccent) {
      savedSettings.accentColor = "";
    }
    this.settings = { ...DEFAULT_SETTINGS, ...savedSettings };
    if (migrateLegacyAccent) {
      await this.saveData(this.settings);
    }
  }

  async saveSettings() {
    await this.saveData(this.settings);
    updateCssSettings(this.settings);
  }

  onunload() {
    if (this.closeButtonIdleTimeout !== null) {
      window.clearTimeout(this.closeButtonIdleTimeout);
    }
    clearCssSettings();
  }

  private resetCloseButtonIdleTimer() {
    if (this.closeButtonIdleTimeout !== null) {
      window.clearTimeout(this.closeButtonIdleTimeout);
    }
    document.documentElement.removeClass("snap-slides-close-button-idle");
    this.closeButtonIdleTimeout = window.setTimeout(() => {
      this.closeButtonIdleTimeout = null;
      if (document.querySelector(".slides-close-btn")) {
        document.documentElement.addClass("snap-slides-close-button-idle");
      }
    }, 2500);
  }
}

class SnapSlidesSettingTab extends PluginSettingTab {
  plugin: SnapSlidesPlugin;

  constructor(app: App, plugin: SnapSlidesPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  // Obsidian 1.13+ uses these definitions; display() remains the legacy fallback.
  getSettingDefinitions(): SettingDefinitionItem<keyof SnapSlidesSettings>[] {
    const stylingVisible = () => this.plugin.settings.enableStyling;
    const mobileVisible = () => this.plugin.settings.enableMobileStyling;

    return [
      {
        name: "Enable styling",
        desc: "Enable or disable all slide appearance modifications (except scrolling and mobile).",
        control: { type: "toggle", key: "enableStyling" }
      },
      {
        name: "Scrollable slides",
        desc: "Allow slides to scroll vertically when content overflows (desktop/tablet).",
        control: { type: "toggle", key: "scrollableSlides" }
      },
      {
        name: "Output folder",
        desc: "Folder to save generated slide notes (leave blank for vault root).",
        control: { type: "text", key: "outputFolder", placeholder: "Slides" }
      },
      {
        name: "Styling",
        searchable: false,
        visible: stylingVisible,
        render: setting => {
          setting.setHeading();
        }
      },
      {
        name: "Sizes",
        searchable: false,
        visible: stylingVisible,
        render: setting => {
          setting.setHeading();
        }
      },
      {
        name: "Base font size",
        desc: "Font size for slide content (e.g., 1.6em, 22px)",
        visible: stylingVisible,
        control: { type: "text", key: "baseFontSize" }
      },
      {
        name: "H1 font size",
        desc: "Font size for h1 headings (e.g., 2em, 32px)",
        visible: stylingVisible,
        control: { type: "text", key: "h1FontSize" }
      },
      {
        name: "H2 font size",
        desc: "Font size for h2 headings (e.g., 1.4em, 28px)",
        visible: stylingVisible,
        control: { type: "text", key: "h2FontSize" }
      },
      {
        name: "Slide side padding",
        desc: "Left/right padding for slides (e.g., 3vw, 32px)",
        visible: stylingVisible,
        control: { type: "text", key: "slidePadding" }
      },
      {
        name: "Heading top margin",
        desc: "Top margin for non-first headings (e.g., 2.5em, 40px)",
        visible: stylingVisible,
        control: { type: "text", key: "headingMarginTop" }
      },
      {
        name: "Colors",
        searchable: false,
        visible: stylingVisible,
        render: setting => {
          setting.setHeading();
        }
      },
      {
        name: "Accent color",
        desc: "Defaults to Obsidian's accent color. Choose a color to override it.",
        visible: stylingVisible,
        render: setting => this.renderAccentColorSetting(setting)
      },
      {
        name: "H1 color",
        desc: "Color for h1 headings",
        visible: stylingVisible,
        control: { type: "color", key: "h1Color", defaultValue: "#A2CF80" }
      },
      {
        name: "H2 color",
        desc: "Color for h2 headings",
        visible: stylingVisible,
        control: { type: "color", key: "h2Color", defaultValue: "#FFD700" }
      },
      {
        name: "H3 color",
        desc: "Color for h3 headings",
        visible: stylingVisible,
        control: { type: "color", key: "h3Color", defaultValue: "#FF8C00" }
      },
      {
        name: "H4 color",
        desc: "Color for h4 headings",
        visible: stylingVisible,
        control: { type: "color", key: "h4Color", defaultValue: "#1E90FF" }
      },
      {
        name: "H5 color",
        desc: "Color for h5 headings",
        visible: stylingVisible,
        control: { type: "color", key: "h5Color", defaultValue: "#BA55D3" }
      },
      {
        name: "H6 color",
        desc: "Color for h6 headings",
        visible: stylingVisible,
        control: { type: "color", key: "h6Color", defaultValue: "#FF69B4" }
      },
      {
        type: "group",
        heading: "Mobile",
        items: [
          {
            name: "Enable mobile styling",
            desc: "Enable custom mobile presentation styling (scaling, close icon, etc).",
            control: { type: "toggle", key: "enableMobileStyling" }
          },
          {
            name: "Mobile font size (vertical/portrait)",
            desc: "Base font size for slides in vertical (portrait) mobile presentation mode (e.g., 4vw).",
            visible: mobileVisible,
            control: { type: "text", key: "mobileFontSizeVertical" }
          },
          {
            name: "Mobile font size (horizontal/landscape)",
            desc: "Base font size for slides in horizontal (landscape) mobile presentation mode (e.g., 3vw).",
            visible: mobileVisible,
            control: { type: "text", key: "mobileFontSizeHorizontal" }
          },
          {
            name: "Mobile scrollable slides",
            desc: "Allow slides to scroll vertically when content overflows (mobile only).",
            visible: mobileVisible,
            control: { type: "toggle", key: "mobileScrollableSlides" }
          },
          {
            name: "Center content vertically on mobile",
            desc: "Center slides that fit vertically. Oversized slides start at the top when scrolling is enabled.",
            visible: mobileVisible,
            control: { type: "toggle", key: "centerMobileVertically" }
          }
        ]
      }
    ];
  }

  private renderAccentColorSetting(setting: Setting): void {
    let colorPicker: ColorComponent | null = null;
    setting
      .addColorPicker(picker => {
        colorPicker = picker;
        picker
          .setValue(this.plugin.settings.accentColor || getObsidianAccentColor())
          .onChange(async value => {
            this.plugin.settings.accentColor = value;
            await this.plugin.saveSettings();
          });
      })
      .addButton(button =>
        button
          .setButtonText("Use theme accent")
          .onClick(async () => {
            this.plugin.settings.accentColor = "";
            await this.plugin.saveSettings();
            colorPicker?.setValue(getObsidianAccentColor());
          })
      );
  }

  override async setControlValue(key: string, value: unknown): Promise<void> {
    if (isBooleanSettingKey(key)) {
      if (typeof value !== "boolean") {
        throw new TypeError(`Expected a boolean value for setting "${key}".`);
      }
      this.plugin.settings[key] = value;
    } else if (isStringSettingKey(key)) {
      if (typeof value !== "string") {
        throw new TypeError(`Expected a string value for setting "${key}".`);
      }
      this.plugin.settings[key] = value;
    } else {
      throw new Error(`Unknown Snap Slides setting "${key}".`);
    }

    await this.plugin.saveSettings();
  }

  display(): void {
    this.renderLegacySettings();
  }

  private renderLegacySettings(): void {
    const { containerEl } = this;
    containerEl.empty();

    // --- Settings Section (always visible) ---
    // Enable styling
    new Setting(containerEl)
      .setName("Enable styling")
      .setDesc("Enable or disable all slide appearance modifications (except scrolling and mobile).")
      .addToggle(toggle =>
        toggle
          .setValue(this.plugin.settings.enableStyling)
          .onChange(async value => {
            this.plugin.settings.enableStyling = value;
            await this.plugin.saveSettings();
            this.renderLegacySettings();
          })
      );

    // Scrollable Slides
    new Setting(containerEl)
      .setName("Scrollable slides")
      .setDesc("Allow slides to scroll vertically when content overflows (desktop/tablet).")
      .addToggle(toggle =>
        toggle
          .setValue(this.plugin.settings.scrollableSlides)
          .onChange(async value => {
            this.plugin.settings.scrollableSlides = value;
            await this.plugin.saveSettings();
          })
      );

    // Output Folder
    new Setting(containerEl)
      .setName("Output folder")
      .setDesc("Folder to save generated slide notes (leave blank for vault root).")
      .addText(text =>
        text
          .setPlaceholder("Slides")
          .setValue(this.plugin.settings.outputFolder)
          .onChange(async value => {
            this.plugin.settings.outputFolder = value;
            await this.plugin.saveSettings();
          })
      );

    // --- Styling Section (only if styling is enabled) ---
    if (this.plugin.settings.enableStyling) {
      new Setting(containerEl).setName("Styling").setHeading();

      // --- Sizes Subsection ---
      new Setting(containerEl).setName("Sizes").setHeading();
      new Setting(containerEl)
        .setName("Base font size")
        .setDesc("Font size for slide content (e.g., 1.6em, 22px)")
        .addText(text =>
          text
            .setValue(this.plugin.settings.baseFontSize)
            .onChange(async value => {
              this.plugin.settings.baseFontSize = value;
              await this.plugin.saveSettings();
            })
        );
      new Setting(containerEl)
        .setName("H1 font size")
        .setDesc("Font size for h1 headings (e.g., 2em, 32px)")
        .addText(text =>
          text
            .setValue(this.plugin.settings.h1FontSize)
            .onChange(async value => {
              this.plugin.settings.h1FontSize = value;
              await this.plugin.saveSettings();
            })
        );
      new Setting(containerEl)
        .setName("H2 font size")
        .setDesc("Font size for h2 headings (e.g., 1.4em, 28px)")
        .addText(text =>
          text
            .setValue(this.plugin.settings.h2FontSize)
            .onChange(async value => {
              this.plugin.settings.h2FontSize = value;
              await this.plugin.saveSettings();
            })
        );
      new Setting(containerEl)
        .setName("Slide side padding")
        .setDesc("Left/right padding for slides (e.g., 3vw, 32px)")
        .addText(text =>
          text
            .setValue(this.plugin.settings.slidePadding)
            .onChange(async value => {
              this.plugin.settings.slidePadding = value;
              await this.plugin.saveSettings();
            })
        );
      new Setting(containerEl)
        .setName("Heading top margin")
        .setDesc("Top margin for non-first headings (e.g., 2.5em, 40px)")
        .addText(text =>
          text
            .setValue(this.plugin.settings.headingMarginTop)
            .onChange(async value => {
              this.plugin.settings.headingMarginTop = value;
              await this.plugin.saveSettings();
            })
        );

      // --- Colors Subsection ---
      new Setting(containerEl).setName("Colors").setHeading();
      const accentColorSetting = new Setting(containerEl)
        .setName("Accent color")
        .setDesc("Defaults to Obsidian's accent color. Choose a color to override it.");
      this.renderAccentColorSetting(accentColorSetting);
      new Setting(containerEl)
        .setName("H1 color")
        .setDesc("Color for h1 headings")
        .addColorPicker(picker =>
          picker
            .setValue(this.plugin.settings.h1Color || "#A2CF80")
            .onChange(async value => {
              this.plugin.settings.h1Color = value || "#A2CF80";
              await this.plugin.saveSettings();
            })
        );
      new Setting(containerEl)
        .setName("H2 color")
        .setDesc("Color for h2 headings")
        .addColorPicker(picker =>
          picker
            .setValue(this.plugin.settings.h2Color || "#FFD700")
            .onChange(async value => {
              this.plugin.settings.h2Color = value || "#FFD700";
              await this.plugin.saveSettings();
            })
        );
      new Setting(containerEl)
        .setName("H3 color")
        .setDesc("Color for h3 headings")
        .addColorPicker(picker =>
          picker
            .setValue(this.plugin.settings.h3Color || "#FF8C00")
            .onChange(async value => {
              this.plugin.settings.h3Color = value || "#FF8C00";
              await this.plugin.saveSettings();
            })
        );
      new Setting(containerEl)
        .setName("H4 color")
        .setDesc("Color for h4 headings")
        .addColorPicker(picker =>
          picker
            .setValue(this.plugin.settings.h4Color || "#1E90FF")
            .onChange(async value => {
              this.plugin.settings.h4Color = value || "#1E90FF";
              await this.plugin.saveSettings();
            })
        );
      new Setting(containerEl)
        .setName("H5 color")
        .setDesc("Color for h5 headings")
        .addColorPicker(picker =>
          picker
            .setValue(this.plugin.settings.h5Color || "#BA55D3")
            .onChange(async value => {
              this.plugin.settings.h5Color = value || "#BA55D3";
              await this.plugin.saveSettings();
            })
        );
      new Setting(containerEl)
        .setName("H6 color")
        .setDesc("Color for h6 headings")
        .addColorPicker(picker =>
          picker
            .setValue(this.plugin.settings.h6Color || "#FF69B4")
            .onChange(async value => {
              this.plugin.settings.h6Color = value || "#FF69B4";
              await this.plugin.saveSettings();
            })
        );
    }

    // --- Mobile Section ---
    new Setting(containerEl).setName("Mobile").setHeading();
    new Setting(containerEl)
      .setName("Enable mobile styling")
      .setDesc("Enable custom mobile presentation styling (scaling, close icon, etc).")
      .addToggle(toggle =>
        toggle
          .setValue(this.plugin.settings.enableMobileStyling)
          .onChange(async value => {
            this.plugin.settings.enableMobileStyling = value;
            await this.plugin.saveSettings();
            this.renderLegacySettings();
          })
      );

    if (this.plugin.settings.enableMobileStyling) {
      new Setting(containerEl)
        .setName("Mobile font size (vertical/portrait)")
        .setDesc("Base font size for slides in vertical (portrait) mobile presentation mode (e.g., 4vw).")
        .addText(text =>
          text
            .setValue(this.plugin.settings.mobileFontSizeVertical)
            .onChange(async value => {
              this.plugin.settings.mobileFontSizeVertical = value;
              await this.plugin.saveSettings();
            })
        );
      new Setting(containerEl)
        .setName("Mobile font size (horizontal/landscape)")
        .setDesc("Base font size for slides in horizontal (landscape) mobile presentation mode (e.g., 3vw).")
        .addText(text =>
          text
            .setValue(this.plugin.settings.mobileFontSizeHorizontal)
            .onChange(async value => {
              this.plugin.settings.mobileFontSizeHorizontal = value;
              await this.plugin.saveSettings();
            })
        );
      new Setting(containerEl)
        .setName("Mobile scrollable slides")
        .setDesc("Allow slides to scroll vertically when content overflows (mobile only).")
        .addToggle(toggle =>
          toggle
            .setValue(this.plugin.settings.mobileScrollableSlides)
            .onChange(async value => {
              this.plugin.settings.mobileScrollableSlides = value;
              await this.plugin.saveSettings();
            })
        );
      new Setting(containerEl)
        .setName("Center content vertically on mobile")
        .setDesc("Center slides that fit vertically. Oversized slides start at the top when scrolling is enabled.")
        .addToggle(toggle =>
          toggle
            .setValue(this.plugin.settings.centerMobileVertically)
            .onChange(async value => {
              this.plugin.settings.centerMobileVertically = value;
              await this.plugin.saveSettings();
            })
        );
    }
  }
}