var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var warp_api_definitions_exports = {};
__export(warp_api_definitions_exports, {
  WarpApiDefinitions: () => WarpApiDefinitions
});
module.exports = __toCommonJS(warp_api_definitions_exports);
var import_models = require("./models");
class WarpApiDefinitions {
  constructor(warpProduct) {
    this.deletedParameterIds = {
      "0.0.1": [],
      "0.0.2": ["esp"],
      "0.1.0": ["info.version", "info.model", "info.product", "evse", "meter", "nfc"]
    };
    this._definedSections = [];
    this.getAllSections = () => this._definedSections;
    this.getAllSectionsForProduct = () => this.getAllSections().filter((section) => section.hasParametersFor(this._warpProduct));
    this.getSectionByTopicForProduct = (topic) => this.getAllSectionsForProduct().find((section) => section.topic === topic);
    this.getSectionByIdForProduct = (id) => this.getAllSectionsForProduct().find((section) => id.includes(section.id));
    this._warpProduct = warpProduct;
    this._definedSections = [
      ...this.defineEvse().sections,
      ...this.defineMeter().sections,
      ...this.defineChargeManager().sections,
      ...this.defineUsers().sections,
      ...this.defineChargeTracker().sections,
      ...this.defineNfc().sections,
      ...this.defineNetwork().sections,
      ...this.defineWifi().sections,
      ...this.defineEthernet().sections,
      ...this.defineNtp().sections,
      ...this.defineMqtt().sections,
      ...this.defineInfo().sections
    ];
  }
  defineEvse() {
    const evse = new import_models.WarpApi("evse", "Charge controller");
    evse.add("evse/state", "The state of the charge controller", [
      import_models.Param.enum("iec61851_state", { 0: "NOT_CONNECTED", 1: "CONNECTED", 2: "CHARGING", 3: "CHARGING_WITH_VENTILATION", 4: "ERROR" }).withDescription("The current state according to IEC 61851").build(),
      import_models.Param.enum("charger_state", { 0: "NOT_CONNECTED", 1: "CONNECTED", 2: "CHARGING", 3: "ERROR" }).withDescription("The current status, processed by the charge controller").build(),
      import_models.Param.enum("contactor_state", { 0: "NOT_LIVE_BEFORE_AND_AFTER_CONTRACTOR", 1: "LIVE_BEFORE_BUT_NOT_AFTER_CONTRACTOR", 2: "NOT_LIVE_BEFORE_BUT_AFTER_CONTRACTOR", 3: "LIVE_BEFORE_AND_AFTER_CONTRACTOR" }).withDescription("The voltage before and after the contactor is monitored").build(),
      import_models.Param.numb("contactor_error").withDescription("Error code of the contactor monitoring. A value other than 0 indicates an error").build(),
      import_models.Param.numb("allowed_charging_current", "mA").withDescription("Maximum allowed charging current provided to the vehicle").build(),
      import_models.Param.enum("error_state", { 0: "OK", 1: "SWITCH_ERROR", 2: "CALIBRATION_ERROR", 3: "CONTRACTOR_ERROR", 4: "COMMUNICATION_ERROR" }).withDescription("The current error state").build(),
      import_models.Param.enum("lock_state", { 0: "INIT", 1: "OPEN", 2: "CLOSING", 3: "CLOSED", 4: "OPENING", 5: "ERROR" }).withDescription("State of the cable lock (only relevant for wallboxes with type 2 socket)").build(),
      import_models.Param.enum("dc_fault_current_state", { 0: "NO_ERROR", 1: "6_MA_FAULT_CURRENT", 2: "SYSTEM_ERROR", 3: "UNKNOWN_ERROR", 4: "CALIBRATION_ERROR" }).onlyWarp2().withDescription("The state of the DC residual current protection module").build()
    ]);
    evse.add("evse/hardware_configuration", "The hardware configuration of the charge controller", [
      import_models.Param.enum("jumper_configuration", { 0: "6_AMPERE", 1: "10_AMPERE", 2: "13_AMPERE", 3: "16_AMPERE", 4: "20_AMPERE", 5: "25_AMPERE", 6: "32_AMPERE", 7: "CONTROLLED_BY_SOFTWARE", 8: "NOT_CONFIGURED" }).withDescription("The maximum current of the incoming cable. This current is configured on the charge controller by jumpers or a plug-in board with switches").build(),
      import_models.Param.bool("has_lock_switch").withDescription("Indicates whether the wallbox has a cable lock").build(),
      import_models.Param.enum("evse_version", { 14: "EVSE_1_4", 15: "EVSE_1_5", 20: "EVSE_2_0" }).withDescription("Hardware version of the charge controller").build(),
      import_models.Param.enum("energy_meter_type", { 0: "NO_METER", 1: "SDM72", 2: "SDM630", 3: "SDM72V2" }).onlyWarp2().withDescription("Hardware version of the charge controller").build()
    ]);
    evse.add("evse/slots", "The state of the charging slots", [
      import_models.Param.list("slots", "json").withDescription("Last 10 slots").build()
    ]);
    evse.add("evse/button_state", "The status of the button in the front panel", [
      import_models.Param.numb("button_press_time", "ms").withDescription("Time at which the button was last pressed. 0 if the button has not been pressed since the charge controller was started").build(),
      import_models.Param.numb("button_release_time", "ms").withDescription("Time at which the button was last released. 0 if the button has not been pressed since the charge controller was started").build(),
      import_models.Param.bool("button_pressed").withDescription("true, if the button is currently pressed, otherwise false").build()
    ]);
    evse.add("evse/indicator_led", "The state of the LED in the button", [
      import_models.Param.numb("indication").withDescription("-1 = Controlled by EVSE; 0 = Off; 1-254 = Dimmed; 255 = On; 1001 = Confirming flashing; 1002 = Rejecting flashing; 1003 = Prompting flashing").build(),
      import_models.Param.numb("duration", "ms").withDescription("Duration for which the set state is maintained").build()
    ]);
    evse.add("evse/low_level_state", "The low-level state of the charge controller", [
      import_models.Param.enum("led_state", { 0: "OFF", 1: "ON", 2: "FLASHING", 3: "FLICKERING", 4: "BREATHES", 5: "API" }).withDescription("The status of the LED connected to the charge controller").build(),
      import_models.Param.numb("cp_pwm_duty_cycle", "%/10").withDescription("Pulse width modulation duty cycle on the CP signal").build(),
      import_models.Param.list("adc_values", "number").onlyWarp1().withDescription("16-bit ADC raw values of the voltage measurements: CP/PE | PP/PE").build(),
      import_models.Param.list("adc_values", "number").onlyWarp2().withDescription("16-bit ADC raw values of the voltage measurements: CP/PE before resistor (PWM High) | CP/PE after resistor (PWM High) | CP/PE before resistor (PWM Low) | CP/PE after resistor (PWM Low) | +12V Rail | -12V Rail").build(),
      import_models.Param.list("voltages", "number").onlyWarp1().withDescription("Voltages [mV] calculated from the ADC values: CP/PE | PP/PE | Maximum voltage CP/PE").build(),
      import_models.Param.list("voltages", "number").onlyWarp2().withDescription("Voltages [mV] calculated from the ADC values: CP/PE before resistor (PWM High) | CP/PE after resistor (PWM High) | CP/PE before resistor (PWM Low) | CP/PE after resistor (PWM Low) | PP/PE | +12V Rail | -12V Rail").build(),
      import_models.Param.list("resistances", "number").withDescription("Resistors [\u03A9] calculated from the voltages: CP/PE | PP/PE").build(),
      import_models.Param.list("gpio", "bool").onlyWarp1().withDescription("Signals on the GPIOs: Input | Output | Motor input switch | Relais | Motor error").build(),
      import_models.Param.list("gpio", "bool").onlyWarp2().withDescription("Signals on the GPIOs: Input | Power configuration 0 | Motor error | Direct current error | Power configuration 1 | DC fault current protection test | Shutdown | Button | CP-PWM | Motor input switch | Contactor control | Configurable output | CP disconnection | Motor active | Motor phase | Contactor test before | Contactor test after | Configurable input | DC X6 | DC X30 | LED").build(),
      import_models.Param.numb("charging_time", "ms").withDescription("Approximate time of the charging process. To be used for charge management purposes only!").build(),
      import_models.Param.numb("time_since_state_change", "ms").withDescription("Time since the last IEC 61851 state change. If the state is 2 (= B: Charging).build(), this value corresponds to the charging time").build(),
      import_models.Param.numb("uptime", "ms").withDescription("Time since starting the charge controller").build()
    ]);
    evse.add("evse/external_current", "The charging current specified by the external controller", [
      import_models.Param.numb("current", "mA", 0, 32e3).withDescription("The charging current specified by the external controller").actionUpdateValue("evse/external_current_update", `{ "current": # }`).build()
    ]);
    evse.add("evse/external_clear_on_disconnect", "Specifies whether the charge current specified by the external charge control should be automatically set to 0 when a vehicle is unplugged", [
      import_models.Param.bool("clear_on_disconnect").withDescription("Specifies whether the charge current specified by the external charge control should be automatically set to 0 when a vehicle is unplugged").actionUpdateValue("evse/external_clear_on_disconnect_update", `{ "clear_on_disconnect": # }`).build()
    ]);
    evse.add("evse/management_current", "The charging current specified by the charge management", [
      import_models.Param.numb("current", "mA", 0, 32e3).withDescription("The charging current specified by the charge management").actionUpdateValue("evse/management_current_update", `{ "current": # }`).build()
    ]);
    evse.add("evse/auto_start_charging", "Configures whether a connected vehicle is charged independently", [
      import_models.Param.bool("auto_start_charging").withDescription("Configures whether a connected vehicle is charged independently. If activated, the charging process starts immediately when the vehicle is connected").actionUpdateValue("evse/auto_start_charging_update", `{ "auto_start_charging": # }`).build()
    ]);
    evse.add("evse/global_current", "The charging current specified via the web interface", [
      import_models.Param.numb("current", "mA", 0, 32e3).withDescription("The charging current specified via the web interface").actionUpdateValue("evse/global_current_update", `{ "current": # }`).build()
    ]);
    evse.add("evse/management_enabled", "Indicates whether the charge management charging slot is active", [
      import_models.Param.bool("enabled").withDescription("Indicates whether the charge management charging slot is active").actionUpdateValue("evse/management_enabled_update", `{ "enabled": # }`).build()
    ]);
    evse.add("evse/user_current", "The charging current allowed by the user authorisation", [
      import_models.Param.numb("current", "mA", 0, 32e3).withDescription("The charging current allowed by the user authorisation").actionUpdateValue("evse/user_current_update", `{ "current": # }`).build()
    ]);
    evse.add("evse/user_enabled", "Indicates whether the charging slot of the user authorisation is active", [
      import_models.Param.bool("enabled").withDescription("Indicates whether the charging slot of the user authorisation is active").actionUpdateValue("evse/user_enabled_update", `{ "enabled": # }`).build()
    ]);
    evse.add("evse/external_enabled", "Indicates whether the charging slot of the external control is active", [
      import_models.Param.bool("enabled").withDescription("Indicates whether the charging slot of the external control is active").actionUpdateValue("evse/external_enabled_update", `{ "enabled": # }`).build()
    ]);
    evse.add("evse/external_defaults", "The settings of the charging slot of the external controller taken over after a restart of the charge controller", [
      import_models.Param.numb("current", "mA", 0, 32e3).withDescription("The maximum current in the charging slot of the external control taken over after a restart").actionUpdateConfig("evse/external_defaults_update").build(),
      import_models.Param.bool("clear_on_disconnect").withDescription("Indicates whether the charging current of this slot is set to 0 when a vehicle is unplugged").actionUpdateConfig("evse/external_defaults_update").build()
    ]);
    evse.add("evse/gpio_configuration", "The configuration of the configurable inputs and outputs", [
      import_models.Param.enum("shutdown_input", { 0: "NOT_CONFIGURED", 1: "TURN_OFF_WHEN_OPENED", 2: "TURN_OFF_WHEN_CLOSED" }).onlyWarp2().withDescription("The configuration of the switch-off input").build(),
      import_models.Param.enum("input", { 0: "NOT_CONFIGURED" }).onlyWarp2().withDescription("The configuration of the configurable input").build(),
      import_models.Param.enum("output", { 0: "CONNECTED_TO_GROUND", 1: "HIGH_IMPEDANCE" }).onlyWarp2().withDescription("The configuration of the configurable output").build()
    ]);
    evse.add("evse/button_configuration", "The configuration of the button in the front panel", [
      import_models.Param.enum("button", { 0: "DEACTIVATED", 1: "CHARGE_START_WHEN_PRESSED", 2: "CHARGE_STOP_WHEN_PRESSED", 3: "CHARGE_TOGGLE_WHEN_PRESSED" }).onlyWarp2().withDescription("The configuration of the button in the front panel").actionUpdateConfig("evse/button_configuration_update").build()
    ]);
    evse.add("evse/user_calibration", "Allows the factory calibration of the EVSE to be read and overwritten", [
      import_models.Param.bool("user_calibration_active").onlyWarp1().withDescription("Indicates whether the factory calibration has been overwritten").build(),
      import_models.Param.numb("voltage_diff").onlyWarp1().withDescription("One of the calibration parameters").build(),
      import_models.Param.numb("voltage_mul").onlyWarp1().withDescription("One of the calibration parameters").build(),
      import_models.Param.numb("voltage_div").onlyWarp1().withDescription("One of the calibration parameters").build(),
      import_models.Param.numb("resistance_2700").onlyWarp1().withDescription("One of the calibration parameters").build(),
      import_models.Param.json("resistance_880").onlyWarp1().withDescription("One of the calibration parameters").build()
    ]);
    evse.add("evse/reset_dc_fault_current_state", "The state of the DC fault current protection module. If a DC fault occurs, charging is no longer possible until the protection module has been reset. Before resetting, it is imperative that the reason for the fault is rectified!", [
      import_models.Param.butt("reset_dc_fault_current_state", "normal").withDescription("Resets the DC residual current protection module. Before resetting, it is imperative that the reason for the fault is rectified!").build()
    ]);
    evse.add("evse/manual_charging", "Allows to start and stop a charging process, when auto start charging is disabled.", [
      import_models.Param.butt("start_charging", "start").withDescription("Starts a charging process").actionSendCommand("evse/start_charging", "PUT").build(),
      import_models.Param.butt("stop_charging", "stop").withDescription("Stops a charging process").actionSendCommand("evse/stop_charging", "PUT").build()
    ]);
    return evse;
  }
  defineMeter() {
    const meter = new import_models.WarpApi("meter", "Electric meter");
    meter.add("meter/state", "The state of the electricity meter", [
      import_models.Param.enum("state", { 0: "NO_METER_CONNECTED", 1: "METER_UNRELIABLE", 2: "METER_CONNECTED" }).withDescription("The state of the electricity meter").build(),
      import_models.Param.enum("type", { 0: "NO_METER", 1: "SDM72", 2: "SDM630", 3: "SDM72V2" }).withDescription("Hardware version of the charge controller").build()
    ]);
    meter.add("meter/values", "The measured values of the electricity meter", [
      import_models.Param.numb("power", "W").withDescription("The current charging power").build(),
      import_models.Param.numb("energy_rel", "kWh").withDescription("The charged energy since the last reset").build(),
      import_models.Param.numb("energy_abs", "kWh").withDescription("The charged energy since the production of the electricity meter").build()
    ]);
    meter.add("meter/phases", "Connected and active phases", [
      import_models.Param.list("phases_active", "bool").onlyWarp2().withDescription("Active phases: L1 | L2 | L3").build(),
      import_models.Param.list("phases_connected", "bool").onlyWarp2().withDescription("Connected phases: L1 | L2 | L3").build()
    ]);
    meter.add("meter/error_counters", "Error counter of the communication with the electricity meter", [
      import_models.Param.numb("meter").onlyWarp1().withDescription("Communication error between RS485 Bricklet and electricity meter").build(),
      import_models.Param.numb("bricklet").onlyWarp1().withDescription("Communication error between ESP Brick and RS485 Bricklet").build(),
      import_models.Param.numb("bricklet_reset").onlyWarp1().withDescription("Unexpected resets of the RS485 Bricklet").build(),
      import_models.Param.numb("local_timeout").onlyWarp2().withDescription("Local timeout").build(),
      import_models.Param.numb("global_timeout").onlyWarp2().withDescription("Global timeout").build(),
      import_models.Param.numb("illegal_function").onlyWarp2().withDescription("Illegal function").build(),
      import_models.Param.numb("illegal_data_access").onlyWarp2().withDescription("Illegal data access").build(),
      import_models.Param.numb("illegal_data_value").onlyWarp2().withDescription("Illegal data value").build(),
      import_models.Param.numb("slave_device_failure").onlyWarp2().withDescription("Slave device failure").build()
    ]);
    meter.add("meter/all_values", "All measured values measured by the built-in electricity meter", [
      import_models.Param.list("all_values", "number").onlyWarp2().withDescription("Voltage [V] against neutral L1 | L2 | L3 | Power [A] L1 | L2 | L3 | Active power [W] L1 | L2 | L3 | Apparent power [VA] L1 | L2 | L3 | Reactive power [var] L1 | L2 | L3 | Power factor L1 | L2 | L3 | Relative phase shift [\xB0] L1 | L2 | L3 | Avg voltage against neutral [V] | Avg power [A] | Total phase currents [A] | Total active power [W] | Total apparent power [VA] | Total reactive power [var] | Total power factor | Total relative phase shift [\xB0] | Frequency of the supply voltage [Hz] | Active energy (import; taken from the vehicle) [kWh] | Active energy (export; delivered from the vehicle) [kWh] | Reactive energy (import; taken from the vehicle) [kvarh] | Reactive energy (export; delivered from the vehicle) [kvarh] | Total apparent energy [kVAh] | Transported electric charge [Ah] | Used active power [W] | Max. used active power [W] | Used apparent power [VA] | Max. used apparent power [VA] | Used neutral conductor power [A] | Max. used neutral conductor power [A] | Voltage L1 to L2 [V] | Voltage L2 to L3 [V] | Voltage L3 to L1 [V] | Avg voltage between phases [V] | Neutral conductor power [A] | THD of voltage [%] L1 | L2 | L3 | THD of power [%] L1 | L2 | l3 | THD of voltage [%] | THD of power [%] | Used power [A] L1 | L2 | L3 | Max. used power [A] L1 | L2 | L3 | THD voltage L1 to L2 [%] | THD voltage L2 to L3 [%] | THD voltage L3 to L1 [%] | Avg. THD voltage between phases [%] | Total active energy [kWh] | Total reactive energy [kvarh] | Active energy (import; taken from the vehicle) [kWh] L1 | L2 | L3 | Active energy (export; delivered from the vehicle) [kWh] L1 | L2 | L3 | Total active energy [kWh]; import-export sum L1 | L2 | L3 | Reactive energy (import; taken from the vehicle) [kvarh] L1 | L2 | L3 | Reactive energy (export; delivered from the vehicle) [kvarh] L1 | L2 | L3 | Total reactive energy [kvarh]; import-export sum L1 | L2 | L3").build()
    ]);
    meter.add("meter/reset", "Resets the energy meter", [
      import_models.Param.butt("reset").withDescription("Resets the energy meter").actionSendCommand("meter/reset", "PUT").build()
    ]);
    return meter;
  }
  defineChargeManager() {
    const chargeManager = new import_models.WarpApi("charge_manager", "Charge manager");
    chargeManager.add("charge_manager/available_current", "The currently available power. This electricity is divided among the configured wallboxes", [
      import_models.Param.numb("current", "mA").withDescription("The currently available power").build()
    ]);
    chargeManager.add("charge_manager/state", "The status of the charge manager and all configured wallboxes", [
      import_models.Param.enum("state", { 0: "UNCONFIGURED", 1: "ACTIVE", 2: "ERROR" }).withDescription("The currently state of the charge manager").build(),
      import_models.Param.numb("uptime", "ms").withDescription("Time since activated charge manager").build(),
      import_models.Param.json("chargers").withDescription("List of configurated wallboxes").build()
    ]);
    chargeManager.add("charge_manager/config", "The charge manager configuration", [
      import_models.Param.bool("enable_charge_manager").withDescription("Specifies whether the charge manager should be activated").build(),
      import_models.Param.bool("enable_watchdog").withDescription("Specifies whether the watchdog should be activated").build(),
      import_models.Param.bool("verbose").withDescription("Specifies whether each power distribution is to be noted in the event log").build(),
      import_models.Param.numb("default_available_current", "mA").withDescription("Power to be available after restarting the charge manager").build(),
      import_models.Param.numb("maximum_available_current", "mA").withDescription("Maximum that may be set as available current via the API and the web interface. Should be configured to the maximum permitted power of the connection of the wallbox network, which is limited e.g. by the house connection, the fuse protection or the supply line").build(),
      import_models.Param.numb("minimum_current", "mA").withDescription("Smallest amount of power to be allocated to a wallbox so that it starts a charging process. This can be used to influence how many wallboxes charge at the same time").build(),
      import_models.Param.list("chargers", "json").withDescription("List of wallboxes that are to be controlled by the charge manager").build()
    ]);
    return chargeManager;
  }
  defineUsers() {
    const users = new import_models.WarpApi("users", "User management");
    users.add("users/config", "User configuration", [
      import_models.Param.list("users", "json").withDescription("Users").build(),
      import_models.Param.numb("next_user_id").withDescription("ID of the next user to be created").build(),
      import_models.Param.bool("http_auth_enabled").withDescription("Specifies whether access data should be required to use the web interface and HTTP API").build()
    ]);
    return users;
  }
  defineChargeTracker() {
    const chargeTracker = new import_models.WarpApi("charge_tracker", "Charge Tracker");
    chargeTracker.add("charge_tracker/state", "State of the charge tracker", [
      import_models.Param.numb("tracked_charges").withDescription("Total number of charges recorded").build(),
      import_models.Param.numb("first_charge_timestamp", "min").withDescription("A Unix timestamp in minutes that indicates the start time of the first load").build()
    ]);
    chargeTracker.add("charge_tracker/last_charges", "The last recorded charges", [
      import_models.Param.list("last_charges", "json").withDescription("The last (up to) 30 recorded charges").build()
    ]);
    chargeTracker.add("charge_tracker/current_charge", "Information on the currently running charging process", [
      import_models.Param.numb("user_id").withDescription("ID of the user who started the charging process").build(),
      import_models.Param.numb("meter_start", "kWh").withDescription("Counter reading at the start of charging").build(),
      import_models.Param.numb("evse_uptime_start", "s").withDescription("Uptime of the charge controller at the start of charging").build(),
      import_models.Param.numb("timestamp_minutes", "min").withDescription("A Unix timestamp in minutes indicating the start time of the charging process").build(),
      import_models.Param.enum("authorization_type", { 0: "USER_RELEASE_DISABLED", 1: "TYPE_LOST", 2: "NFC_RELEASE", 3: "NFC_INJECT_RELEASE" }).withDescription("Indicates how the charging process was released").build(),
      import_models.Param.json("authorization_info").withDescription("Further information on user sharing").build()
    ]);
    chargeTracker.add("charge_tracker/remove_all_charges", "Deletes all recorded charges and user name history", [
      import_models.Param.butt("remove_all").withDescription("Caution - cannot be undone! A restart is then carried out automatically").actionUpdateValue("charge_tracker/remove_all_charges", `{ "do_i_know_what_i_am_doing": true }`).build()
    ]);
    chargeTracker.add("charge_tracker/charge_log", "Outputs all recorded charges in the following binary format", [
      import_models.Param.list("charge_log", "number").withDescription("Charge log").build()
    ]);
    return chargeTracker;
  }
  defineNfc() {
    const nfc = new import_models.WarpApi("nfc", "NFC charging release");
    nfc.add("nfc/seen_tags", "The last NFC tags seen by the wallbox", [
      import_models.Param.list("last_seen_tags", "json").withDescription("List of last seen NFC tags with tag type, tag id and milliseconds since last seen").build()
    ]);
    nfc.add("nfc/inject_tag", "Pretends that a tag has been recognised by the NFC reader", [
      import_models.Param.json("tag").withDescription("Injects the given tag").noRead().actionSendJson("nfc/inject_tag").build()
    ]);
    nfc.add("nfc/config", "The NFC configuration", [
      import_models.Param.json("authorized_tags").withDescription("A list of authorized NFC tags.").build()
    ]);
    return nfc;
  }
  defineNetwork() {
    const network = new import_models.WarpApi("network", "network configuration");
    network.add("network/config", "General network settings", [
      import_models.Param.text("hostname").withDescription("Host name that the wallbox should use in all configured networks").build(),
      import_models.Param.bool("enable_mdns").withDescription("Specifies whether the wallbox should announce the web interface via mDNS in the network").build()
    ]);
    return network;
  }
  defineWifi() {
    const wifi = new import_models.WarpApi("wifi", "WLAN configuration");
    wifi.add("wifi/state", "The currently state of WLAN", [
      import_models.Param.enum("connection_state", { 0: "NOT_CONFIGURED", 1: "NOT_CONNECTED", 2: "CONNECTING", 3: "CONNECTED" }).withDescription("Status of the connection to the configured WLAN").build(),
      import_models.Param.enum("ap_state", { 0: "DEACTIVATED", 1: "ACTIVATED", 2: "FALLBACK_INACTIVE", 3: "FALLBACK_ACTIVE" }).withDescription("Status of the WLAN access point").build(),
      import_models.Param.text("ap_bssid").withDescription("BSSID of the WLAN access point").build(),
      import_models.Param.json("sta_ip").withDescription("Current IP of the wallbox in the configured network. 0.0.0.0 if there is no connection").build(),
      import_models.Param.numb("sta_rssi").withDescription("The current reception quality. 0 if there is no connection, otherwise negative. Values closer to 0 correspond to better reception").build(),
      import_models.Param.text("sta_bssid").withDescription("The BSSID of the remote station to which the wallbox is connected").build()
    ]);
    wifi.add("wifi/scan", "Triggers a scan for WLANs", [
      import_models.Param.butt("scan").withDescription("Triggers a scan for WLANs").actionSendCommand("wifi/scan", "PUT").build()
    ]);
    wifi.add("wifi/sta_config", "The WLAN connection configuration", [
      import_models.Param.bool("enable_sta").withDescription("Indicates whether a WLAN connection to the configured network should be established").build(),
      import_models.Param.text("ssid").withDescription("SSID to which you want to connect").build(),
      import_models.Param.json("bssid").withDescription("BSSID to be connected to").build(),
      import_models.Param.bool("bssid_lock").withDescription("Defines whether only the WLAN with the set BSSID is to be connected to. Leave disabled if repeaters or similar are to be used").build(),
      import_models.Param.text("passphrase").withDescription("The WLAN passphrase. Maximum 63 bytes").build(),
      import_models.Param.text("hostname").withDescription("Host name that the wallbox should use in the configured network").build(),
      import_models.Param.json("ip").withDescription("IP address that the wallbox should use in the configured network").build(),
      import_models.Param.json("gateway").withDescription("Gateway address that the wallbox should use in the configured network").build(),
      import_models.Param.json("subnet").withDescription("Subnet mask that the wallbox should use in the configured network").build(),
      import_models.Param.json("dns").withDescription("DNS server address that the wallbox should use in the configured network").build(),
      import_models.Param.json("dns2").withDescription("Alternative DNS server address that the wallbox should use in the configured network").build()
    ]);
    wifi.add("wifi/ap_config", "The WLAN access point configuration", [
      import_models.Param.bool("enable_ap").withDescription("Indicates whether the access point should be activated").build(),
      import_models.Param.bool("ap_fallback_only").withDescription("Specifies whether the access point should only be activated if the WLAN and LAN connections cannot be established").build(),
      import_models.Param.text("ssid").withDescription("SSID to which you want to connect").build(),
      import_models.Param.bool("hide_ssid").withDescription("True if the SSID is to be hidden, otherwise false").build(),
      import_models.Param.text("passphrase").withDescription("The WLAN passphrase. Maximum 63 byte").build(),
      import_models.Param.text("hostname").withDescription("Host name that the wallbox should use").build(),
      import_models.Param.numb("channel", void 0, 1, 13).withDescription("Channel on which the access point is to be accessible").build(),
      import_models.Param.json("ip").withDescription("IP address that the wallbox should use in the configured network").build(),
      import_models.Param.json("gateway").withDescription("Gateway address that the wallbox should use in the configured network").build(),
      import_models.Param.json("subnet").withDescription("Subnet mask that the wallbox should use in the configured network").build()
    ]);
    wifi.add("wifi/scan_results", "The WLANs found as a result of a search triggered by wifi.scan", [
      import_models.Param.list("scan_results", "json").withDescription("The WLANs found as a result of a search triggered by wifi.scan").build()
    ]);
    return wifi;
  }
  defineEthernet() {
    const ethernet = new import_models.WarpApi("ethernet", "LAN configuration");
    ethernet.add("ethernet/state", "The currently state of LAN", [
      import_models.Param.enum("connection_state", { 0: "NOT_CONFIGURED", 1: "NOT_CONNECTED", 2: "CONNECTING", 3: "CONNECTED" }).withDescription("Status of the connection to the configured LAN").build(),
      import_models.Param.json("ip").withDescription("Current IP of the wallbox in the configured network. 0.0.0.0 if there is no connection").build(),
      import_models.Param.bool("full_duplex").withDescription("True for a full duplex connection, otherwise false").build(),
      import_models.Param.numb("link_speed", "Mbit/s").withDescription("Negotiated connection speed").build()
    ]);
    ethernet.add("ethernet/sta_config", "The WLAN connection configuration", [
      import_models.Param.bool("enable_ethernet").withDescription("Indicates whether a LAN connection to the configured network should be established").build(),
      import_models.Param.text("hostname").withDescription("Host name that the wallbox should use in the configured network").build(),
      import_models.Param.json("ip").withDescription("IP address that the wallbox should use in the configured network").build(),
      import_models.Param.json("gateway").withDescription("Gateway address that the wallbox should use in the configured network").build(),
      import_models.Param.json("subnet").withDescription("Subnet mask that the wallbox should use in the configured network").build(),
      import_models.Param.json("dns").withDescription("DNS server address that the wallbox should use in the configured network").build(),
      import_models.Param.json("dns2").withDescription("Alternative DNS server address that the wallbox should use in the configured network").build()
    ]);
    return ethernet;
  }
  defineNtp() {
    const ntp = new import_models.WarpApi("ntp", "Time synchronization");
    ntp.add("ntp/state", "The state of the time synchronization", [
      import_models.Param.bool("synced").withDescription("Indicates whether the wallbox was able to synchronise its time via NTP").build()
    ]);
    ntp.add("ntp/config", "The NTP configuration", [
      import_models.Param.bool("enable").withDescription("Specifies whether the wallbox should synchronise its time via NTP").build(),
      import_models.Param.bool("use_dhcp").withDescription("Specifies whether the wallbox should synchronise its time via DHCP").build(),
      import_models.Param.text("timezone").withDescription("The time zone in which the wallbox is located").build(),
      import_models.Param.text("server").withDescription("IP address or host name of the time server to be used").build(),
      import_models.Param.text("server2").withDescription("IP address or host name of the alternative time server").build()
    ]);
    return ntp;
  }
  defineMqtt() {
    const mqtt = new import_models.WarpApi("mqtt", "MQTT connection");
    mqtt.add("mqtt/state", "The currently state of MQTT", [
      import_models.Param.enum("connection_state", { 0: "NOT_CONFIGURED", 1: "NOT_CONNECTED", 2: "CONNECTED", 3: "ERROR" }).withDescription("State of the connection to the MQTT broker").build(),
      import_models.Param.numb("last_error").withDescription("The last error that occurred. -1 if no error has occurred").build()
    ]);
    mqtt.add("mqtt/config", "The MQTT configuration", [
      import_models.Param.bool("enable_mqtt").withDescription("Indicates whether an MQTT connection to the configured broker should be established").build(),
      import_models.Param.text("broker_host").withDescription("Host name or IP address of the MQTT broker to which the wallbox is to connect").build(),
      import_models.Param.numb("broker_port").withDescription("Port of the MQTT broker to which the wallbox should connect. Typically 1883").build(),
      import_models.Param.text("broker_username").withDescription("User name with which to connect to the broker. Empty if no authentication is used").build(),
      import_models.Param.text("broker_password").withDescription("Password with which to connect to the broker. Empty if no authentication is used").build(),
      import_models.Param.text("global_topic_prefix").withDescription("Prefix that precedes all MQTT topics").build(),
      import_models.Param.text("client_name").withDescription("Name under which the wallbox registers with the broker").build(),
      import_models.Param.numb("interval", "s").withDescription("Minimum transmission interval per topic in seconds").build()
    ]);
    return mqtt;
  }
  defineInfo() {
    const info = new import_models.WarpApi("info", "General information");
    info.add("info/version", "Wallbox firmware version", [
      import_models.Param.text("firmware").withDescription("The firmware version that is currently running").build(),
      import_models.Param.text("config").withDescription("The version of the configuration that is currently being used").build()
    ]);
    info.add("info/modules", "Initialisation status of the firmware modules", []);
    info.add("info/features", "Supported hardware features", []);
    info.add("info/name", "Wallbox name and type", [
      import_models.Param.text("name").withDescription("The name of the wallbox. Consists of the type and UID of the wallbox").build(),
      import_models.Param.text("type").withDescription("Wallbox type").build(),
      import_models.Param.text("display_type").withDescription("User-readable type of wallbox").build(),
      import_models.Param.text("uid").withDescription("Wallbox/ESP UID").build()
    ]);
    info.add("info/display_name", "User-readable name of the wallbox", [
      import_models.Param.text("display_name").withDescription("Display name").actionUpdateValue("info/display_name_update", `{ "display_name": # }`).build()
    ]);
    return info;
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  WarpApiDefinitions
});
//# sourceMappingURL=warp-api-definitions.js.map
