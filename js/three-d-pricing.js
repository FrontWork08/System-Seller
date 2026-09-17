(function (root, factory) {
  "use strict";
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root && root.SS) {
    root.SS.calculate3DPricing = api.calculate3DPricing;
  }
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";

  function money(value) {
    return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
  }

  function number(input, name) {
    var value = input == null || input === "" ? 0 : Number(input);
    if (!Number.isFinite(value)) throw new Error(name + " precisa ser um número válido.");
    if (value < 0) throw new Error(name + " não pode ser negativo.");
    return value;
  }

  function calculate3DPricing(input) {
    input = input || {};
    var materialG = number(input.material_g, "Material");
    var materialCostPerG = number(input.material_cost_per_g, "Custo por grama");
    var printMinutes = number(input.print_minutes, "Tempo de impressão");
    var printerPowerWatts = number(input.printer_power_watts, "Potência da impressora");
    var electricityPrice = number(input.electricity_price_per_kwh, "Preço da energia");
    var machineHourCost = number(input.machine_hour_cost, "Custo/hora da máquina");
    var laborMinutes = number(input.labor_minutes, "Tempo de mão de obra");
    var laborHourCost = number(input.labor_hour_cost, "Custo/hora da mão de obra");
    var marginPct = number(input.margin_pct, "Margem");
    if (marginPct >= 100) throw new Error("A margem precisa ser menor que 100%.");

    var materialCost = materialG * materialCostPerG;
    var printHours = printMinutes / 60;
    var energyCost = printHours * (printerPowerWatts / 1000) * electricityPrice;
    var machineCost = printHours * machineHourCost;
    var laborCost = (laborMinutes / 60) * laborHourCost;
    var estimatedCostRaw = materialCost + energyCost + machineCost + laborCost;
    var suggestedRaw = marginPct === 0 ? estimatedCostRaw : estimatedCostRaw / (1 - marginPct / 100);
    var hasManualFinal = Object.prototype.hasOwnProperty.call(input, "final_price") && input.final_price !== "" && input.final_price != null;
    var finalPrice = hasManualFinal ? number(input.final_price, "Preço final") : suggestedRaw;

    var result = {
      material_cost: money(materialCost),
      energy_cost: money(energyCost),
      machine_cost: money(machineCost),
      labor_cost: money(laborCost),
      estimated_cost: money(estimatedCostRaw),
      suggested_price: money(suggestedRaw),
      final_price: money(finalPrice)
    };
    result.profit_at_suggested = money(result.suggested_price - result.estimated_cost);
    result.effective_margin_pct = result.suggested_price > 0 ? money(((result.suggested_price - result.estimated_cost) / result.suggested_price) * 100) : 0;
    return result;
  }

  return { calculate3DPricing: calculate3DPricing };
});
