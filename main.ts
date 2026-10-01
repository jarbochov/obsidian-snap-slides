import { App, Plugin, PluginSettingTab, Setting, normalizePath, Notice, MarkdownView, TFile } from "obsidian";

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

const DEFAULT_SETTINGS: SnapSlidesSettings = {
  enableStyling: true,
  outputFolder: "",
  baseFontSize: "1.6em",
  h1FontSize: "2em",
  h2FontSize: "1.4em",
  slidePadding: "3vw",
  headingMarginTop: "2.5em",
  accentColor: "#A2CF80",
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
  document.documentElement.setCssProps({
    "--snap-slides-accent-color": settings.accentColor,
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
  root.removeClasses([
    "snap-slides-styling-enabled",
    "snap-slides-mobile-enabled",
    "snap-slides-scrollable",
    "snap-slides-mobile-scrollable",
    "snap-slides-center-mobile",
    "snap-slides-close-button-idle"
  ]);
  [
    "--snap-slides-accent-color",
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
    const savedSettings =
      typeof savedData === "object" && savedData !== null && !Array.isArray(savedData)
        ? (savedData as Partial<SnapSlidesSettings>)
        : {};
    this.settings = { ...DEFAULT_SETTINGS, ...savedSettings };
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

  display(): void {
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
            this.display(); // Re-render settings tab
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
      new Setting(containerEl)
        .setName("Accent color")
        .setDesc("Accent color for slides (applies to links)")
        .addColorPicker(picker =>
          picker
            .setValue(this.plugin.settings.accentColor || "#A2CF80")
            .onChange(async value => {
              this.plugin.settings.accentColor = value || "#A2CF80";
              await this.plugin.saveSettings();
            })
        );
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
            this.display();
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
        .setDesc("If enabled, the content of each slide is centered vertically in mobile mode (if content fits).")
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