import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import catalog from "../functions/businessCatalog.json" with { type: "json" };
import {
  filterBusinessCategories,
  normalizeCategorySearch,
} from "../src/domain/businessCategorySearch.mjs";

const [picker, quickFields, company, dialog, componentStyles] = await Promise.all([
  readFile(
    new URL("../src/components/BusinessCategoryPicker.jsx", import.meta.url),
    "utf8"
  ),
  readFile(
    new URL("../src/components/QuickBusinessFields.jsx", import.meta.url),
    "utf8"
  ),
  readFile(
    new URL("../src/features/company/CompanyConfig.jsx", import.meta.url),
    "utf8"
  ),
  readFile(
    new URL("../src/components/ui/ResponsiveDialog.jsx", import.meta.url),
    "utf8"
  ),
  readFile(new URL("../src/styles/components.css", import.meta.url), "utf8"),
]);

assert.equal(normalizeCategorySearch("  TECNOLOGÍA  "), "tecnologia");
assert.equal(normalizeCategorySearch("Cafetería"), "cafeteria");
const visibleCategories = filterBusinessCategories(catalog.businessCategories, "");
assert.equal(visibleCategories.length, 7);
assert.deepEqual(
  visibleCategories.map(({ code }) => code),
  [
    "TECNOLOGIA_INFORMATICA",
    "SEGURIDAD_TELECOMUNICACIONES",
    "ELECTRICIDAD_ENERGIA_CLIMATIZACION",
    "AUTOMATIZACION_CONTROL",
    "MANTENIMIENTO_INSTALACIONES",
    "INGENIERIA_CONSULTORIA",
    "OTRO_SERVICIO_PROYECTOS",
  ]
);
assert.equal(visibleCategories.some(({ code }) => code === "RESTAURANTE"), false);
assert.equal(
  visibleCategories.find(({ code }) => code === "OTRO_SERVICIO_PROYECTOS")?.name,
  "Otro servicio por proyectos"
);

const securityResults = filterBusinessCategories(
  catalog.businessCategories,
  "ALARMAS"
);
assert.ok(securityResults.some(({ code }) => code === "SEGURIDAD_TELECOMUNICACIONES"));
// "programación" apuntaba a un rubro que ya no es elegible.
assert.deepEqual(
  filterBusinessCategories(catalog.businessCategories, "PROGRAMACIÓN"),
  []
);
const computingResults = filterBusinessCategories(
  catalog.businessCategories,
  "computacion"
);
assert.ok(computingResults.some(({ code }) => code === "TECNOLOGIA_INFORMATICA"));
assert.equal(
  filterBusinessCategories(catalog.businessCategories, "venta al detalle").some(
    ({ code }) => code === "COMERCIO_MINORISTA"
  ),
  false
);

// Grupo "Próximamente": filas deshabilitadas, sin código y fuera del buscador.
for (const query of [
  "taller",
  "automotriz",
  "veterinaria",
  "clinica",
  "construccion",
  "software",
  "marketing",
]) {
  assert.deepEqual(filterBusinessCategories(catalog.businessCategories, query), []);
}
assert.match(picker, /Próximamente/);
assert.match(picker, /Taller automotriz \(en construcción\)/);
assert.match(picker, /Clínica veterinaria \(en construcción\)/);
assert.match(picker, /label: "Construcción y obras", tag: "Próximamente"/);
assert.match(picker, /label: "Software y soluciones digitales", tag: "Próximamente"/);
assert.match(picker, /label: "Servicios digitales y creativos", tag: "Próximamente"/);
assert.match(picker, /Más rubros próximamente/);
assert.match(picker, /aria-disabled="true"/);
const soonBlock = picker.slice(picker.indexOf('className="business-category-soon"'));
assert.doesNotMatch(soonBlock, /onClick|chooseOption|role="radio"/);
assert.ok(
  picker.indexOf('role="radiogroup"') < picker.indexOf('className="business-category-soon"')
);
assert.match(componentStyles, /\.business-category-option--soon/);

// Nota fiscal para países distintos de Chile (solo presentación).
assert.match(
  quickFields,
  /Moneda y formato disponibles\. Las reglas fiscales \(facturas, boletas, IVA\) están pensadas para Chile y están en revisión\./
);
assert.match(quickFields, /values\.paisCodigo !== "CL"/);

assert.match(quickFields, /<BusinessCategoryPicker/);
assert.match(company, /<BusinessCategoryPicker/);
assert.match(quickFields, /Rubro principal/);
assert.match(company, /Rubro principal/);
assert.match(quickFields, /Elige la actividad que mejor representa tu servicio principal\./);
assert.match(company, /Selecciona la actividad que mejor representa los servicios de tu empresa\./);
assert.doesNotMatch(quickFields, /BUSINESS_CATEGORIES\.filter/);
assert.doesNotMatch(company, /BUSINESS_CATEGORIES\.filter/);
assert.match(picker, /title="Selecciona un rubro"/);
assert.match(picker, /description="Elige la actividad principal de tu negocio\."/);
assert.match(picker, /Selecciona el rubro de tu negocio/);
assert.doesNotMatch(picker, /placeholder="Buscar rubro"/);
assert.doesNotMatch(picker, /type="search"/);
assert.match(
  picker,
  /OTRO_SERVICIO_PROYECTOS: "Otro servicio técnico o profesional"/
);
assert.match(picker, /role="radiogroup"/);
assert.match(picker, /role="radio"/);
assert.match(picker, /draftCode/);
assert.match(picker, /confirmSelection/);
assert.match(picker, /draftCode === "OTRO"/);
assert.match(picker, /Describe el rubro de tu negocio/);
assert.match(picker, /ArrowDown/);
assert.match(
  componentStyles,
  /\.business-category-group__grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/
);
assert.match(
  componentStyles,
  /\.business-category-option\[aria-checked="true"\]\s*\{[\s\S]*?border-color:\s*var\(--color-brand-500\)/
);
assert.match(componentStyles, /\.business-category-option--wide\s*\{/);
assert.match(dialog, /event\.key === "Escape"/);
assert.match(dialog, /openDialogStack\.at\(-1\)/);

console.log(
  "BUSINESS_CATEGORY_SELECTOR_SMOKE_OK",
  JSON.stringify({
    categories: catalog.businessCategories.length,
    sectors: catalog.businessCategorySectors.length,
  })
);
