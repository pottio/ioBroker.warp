
export type WarpApiParameterType = 'enum' | 'number' | 'bool' | 'list' | 'button' | 'json' | 'text';
export type WarpApiActionType = 'update-value' | 'update-config' | 'send-command';
export type WarpApiButtonType = 'normal' | 'start' | 'stop';
export abstract class WarpProduct {
    public static readonly warp1: string = 'warp1';
    public static readonly warp2: string = 'warp2';
    public static readonly all: string[] = [WarpProduct.warp1, WarpProduct.warp2];

}
export abstract class WarpModel {
    public static readonly smart: string = 'smart';
    public static readonly pro: string = 'pro';
    public static readonly all: string[] = [WarpModel.smart, WarpModel.pro];
}

export interface WarpMessage {
    topic: string;
    payload: any;
}

export interface WarpMetaInformation {
    name: string;
    product: WarpProduct;
    displayType: string;
    firmwareVersion: string
    features: string[];
}

export class WarpApi {
    public readonly id: string;
    public readonly description: string;
    public readonly sections: WarpApiSection[];
    public readonly preventCreating: boolean;
    constructor(id: string, description: string, preventCreating = false) {
        this.id = id;
        this.description = description;
        this.sections = [];
        this.preventCreating = preventCreating;
    }

    public add(topic: string, description: string, parameters: WarpApiParameter[]): void {
        this.sections.push(new WarpApiSection(this, topic, description, parameters));
    }
}

export class WarpApiSection {
    public readonly api: WarpApi;
    public readonly topic: string;
    public readonly description: string;
    public readonly parameters: WarpApiParameter[];

    constructor(api: WarpApi, topic: string, description: string, parameters: WarpApiParameter[]) {
        this.api = api;
        this.topic = topic;
        this.description = description;
        this.parameters = parameters;
    }

    public hasParametersFor(product: string): boolean {
        return this.parameters.some(param => param.isRelevantFor(product));
    }

    public filterSpecificParameters(): WarpApiParameter[] {
        return this.parameters.filter(param => param.relevantForProducts !== WarpProduct.all);
    }

    public get id(): string {
        return this.topic.replace('/', '.');
    }

    public toString(): string {
        return `id=${this.id} | parameters=${JSON.stringify(this.parameters)}`;
    }
}

export class WarpApiParameter {

    public name: string;
    public type: WarpApiParameterType;
    public description: string;
    public relevantForProducts: string[];
    //public relevantForModels: string[];
    public actionTopic?: string;
    public actionPayloadTemplate?: any;
    public actionType?: WarpApiActionType;
    public actionMethod?: 'PUT' | 'GET';
    public enumValues?: { [index: number]: string; };
    public unit?: string;
    public listItems?: WarpApiParameter[];
    public min?: number;
    public max?: number;
    public buttonType?: WarpApiButtonType

    constructor(name: string, type: WarpApiParameterType) {
        this.name = name;
        this.description = '';
        this.type = type;
        //this.relevantForModels = WarpModel.all;
        this.relevantForProducts = WarpProduct.all;
    }

    isRelevantFor(product: string): boolean {
        return this.relevantForProducts.some(prod => prod === product);
    }

    hasActionType(actionType: WarpApiActionType): boolean {
        return this.actionType === actionType;
    }

    hasAction(): boolean {
        return this.actionType !== undefined;
    }
}

export class WarpApiParameterBuilder {

    private _warpApiParameter: WarpApiParameter;

    constructor(arpApiParameter: WarpApiParameter) {
        this._warpApiParameter = arpApiParameter;
    }
    withDescription(description: string): WarpApiParameterBuilder {
        this._warpApiParameter.description = description;
        return this;
    }
    onlyWarp1(): WarpApiParameterBuilder {
        this._warpApiParameter.relevantForProducts = [WarpProduct.warp1];
        return this;
    }
    onlyWarp2(): WarpApiParameterBuilder {
        this._warpApiParameter.relevantForProducts = [WarpProduct.warp2];
        return this;
    }
    // onlyModelSmart(): WarpApiParameterBuilder {
    //     this._warpApiParameter.relevantForModels = [WarpModel.smart];
    //     return this;
    // }
    // onlyModelPro(): WarpApiParameterBuilder {
    //     this._warpApiParameter.relevantForModels = [WarpModel.pro];
    //     return this;
    // }
    actionUpdateValue(topic: string, payloadTemplate: any): WarpApiParameterBuilder {
        this._warpApiParameter.actionTopic = topic;
        this._warpApiParameter.actionType = 'update-value';
        this._warpApiParameter.actionPayloadTemplate = payloadTemplate;
        return this;
    }
    actionSendCommand(topic: string, method: 'PUT' | 'GET', payloadTemplate?: any): WarpApiParameterBuilder {
        this._warpApiParameter.actionTopic = topic;
        this._warpApiParameter.actionType = 'send-command';
        this._warpApiParameter.actionMethod = method;
        this._warpApiParameter.actionPayloadTemplate = payloadTemplate;
        return this;
    }
    actionUpdateConfig(topic: string): WarpApiParameterBuilder {
        this._warpApiParameter.actionTopic = topic;
        this._warpApiParameter.actionType = 'update-config';
        return this;
    }
    item(param: WarpApiParameter): WarpApiParameterBuilder {
        if (this._warpApiParameter.listItems) this._warpApiParameter.listItems.push(param);
        return this;
    }
    build(): WarpApiParameter {
        return this._warpApiParameter;
    }
}

export abstract class Param {
    public static bool(name: string): WarpApiParameterBuilder {
        const boolParam = new WarpApiParameter(name, 'bool');
        return new WarpApiParameterBuilder(boolParam);
    }
    public static butt(name: string, buttonType: WarpApiButtonType = 'normal'): WarpApiParameterBuilder {
        const buttonParam = new WarpApiParameter(name, 'button');
        buttonParam.buttonType = buttonType;
        return new WarpApiParameterBuilder(buttonParam);
    }
    public static enum(name: string, enumValues: { [index: number]: string }): WarpApiParameterBuilder {
        const enumParam = new WarpApiParameter(name, 'enum');
        enumParam.enumValues = enumValues;
        return new WarpApiParameterBuilder(enumParam);
    }
    public static list(name: string): WarpApiParameterBuilder {
        const listParam = new WarpApiParameter(name, 'list');
        listParam.listItems = [];
        return new WarpApiParameterBuilder(listParam);
    }
    public static numb(name: string, unit?: string, min?: number, max?: number): WarpApiParameterBuilder {
        const numberParam = new WarpApiParameter(name, 'number');
        numberParam.unit = unit;
        numberParam.min = min;
        numberParam.max = max;
        return new WarpApiParameterBuilder(numberParam);
    }
    public static json(name: string): WarpApiParameterBuilder {
        const jsonParam = new WarpApiParameter(name, 'json');
        return new WarpApiParameterBuilder(jsonParam);
    }
    public static text(name: string): WarpApiParameterBuilder {
        const textParam = new WarpApiParameter(name, 'text');
        return new WarpApiParameterBuilder(textParam);
    }
}

export interface WarpApiMigration {
    deletedParameterIds: string[];
    changedParameterIds: string[];
}