/* Copyright 2016 Google Inc. All Rights Reserved.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
==============================================================================*/

/**
 * A node in a neural network. Each node has a state
 * (total input, output, and their respectively derivatives) which changes
 * after every forward and back propagation run.
 */
export class Node {
  id: string;
  /** List of input links. */
  inputLinks: Link[] = [];
  bias = 0.1;
  /** List of output links. */
  outputs: Link[] = [];
  totalInput: number;
  output: number;
  totalBatchInput: number[] = [];
  batchOutput: number[] = [];
  /** Error derivative with respect to this node's output. */
  outputDer = 0;
  /** Error derivative with respect to this node's total input. */
  inputDer = 0;
  /**
   * Accumulated error derivative with respect to this node's total input since
   * the last update. This derivative equals dE/db where b is the node's
   * bias term.
   */
  accInputDer = 0;
  /**
   * Number of accumulated err. derivatives with respect to the total input
   * since the last update.
   */
  numAccumulatedDers = 0;
  /** Activation function that takes total input and returns node's output */
  activation: ActivationFunction;

  /** 1st and 2nd moment vector for bias */
  mBias = 0.1;
  vBias = 0.1;

  // 新增BN参数
  bnGamma: number = 1;   // 缩放参数
  bnBeta: number = 0;    // 平移参数
  bnMean: number = 0;    // 移动均值
  bnVariance: number = 1;// 移动方差
  bnEpsilon: number = 1e-8;
  bnNormalized: number = 0; // 归一化后的值
  
  // 新增LN参数
  lnGamma: number = 1;    // 缩放参数
  lnBeta: number = 0;     // 平移参数
  lnNormalized: number = 0; // 归一化后的值
  lnMean: number = 0;
  lnVariance: number = 0;
  lnEpsilon: number = 1e-8;
  
  // 新增梯度累积
  bnGammaGrad: number = 0;
  bnBetaGrad: number = 0;
  lnGammaGrad: number = 0;
  lnBetaGrad: number = 0;

  /**
   * Creates a new node with the provided id and activation function.
   */
  constructor(id: string, activation: ActivationFunction, normalization: String, initZero?: boolean) {
    this.id = id;
    this.activation = activation;
    if (initZero) {
      this.bias = 0;
      this.mBias = 0;
      this.vBias = 0;
    }
  }

  /** Recomputes the node's output and returns it. */
  updateOutput(): number {
    // Stores total input into the node.
    this.totalInput = this.bias;
    for (let j = 0; j < this.inputLinks.length; j++) {
      let link = this.inputLinks[j];
      this.totalInput += link.weight * link.source.output;
    }

    this.output = this.activation.output(this.totalInput);
    return this.output;
  }

  updateBatchOutput(): void {
    // Stores total input into the node.
    for (let i = 0; i < this.inputLinks[0].source.batchOutput.length; i++) {
      this.totalInput = this.bias;
      for (let j = 0; j < this.inputLinks.length; j++) {
        let link = this.inputLinks[j];
        this.totalInput += link.weight * link.source.batchOutput[i];
      }

      this.output = this.activation.output(this.totalInput);

      this.totalBatchInput[i] = this.totalInput;
      this.batchOutput[i] = this.output;
    }
  }

  batchNormalization(): void {
    const batchSize = this.batchOutput.length;

    // cal mean
    let mean: number = 0;
    for (let i = 0; i < batchSize; i++) {
      mean += this.batchOutput[i];
    }
    mean /= batchSize;

    // cal var
    let variance: number = 0;
    for (let i = 0; i < batchSize; i++) {
      variance += (this.batchOutput[i] - mean) ** 2;
    }
    variance /= batchSize;

    // normalized
    for (let i = 0; i < batchSize; i++) {
      this.batchOutput[i] = (this.batchOutput[i] - mean) / Math.sqrt(variance + this.bnEpsilon);
      this.batchOutput[i] = this.bnGamma * this.batchOutput[i] + this.bnBeta;
    }
  }
}

/**
 * An error function and its derivative.
 */
export interface ErrorFunction {
  error: (output: number, target: number) => number;
  der: (output: number, target: number) => number;
}

/** A node's activation function and its derivative. */
export interface ActivationFunction {
  output: (input: number) => number;
  der: (input: number) => number;
}

/** Function that computes a penalty cost for a given weight in the network. */
export interface RegularizationFunction {
  output: (weight: number) => number;
  der: (weight: number) => number;
}

/** Built-in error functions */
export class Errors {
  public static SQUARE: ErrorFunction = {
    error: (output: number, target: number) =>
               0.5 * Math.pow(output - target, 2),
    der: (output: number, target: number) => output - target
  };
}

/** Polyfill for TANH */
(Math as any).tanh = (Math as any).tanh || function(x) {
  if (x === Infinity) {
    return 1;
  } else if (x === -Infinity) {
    return -1;
  } else {
    let e2x = Math.exp(2 * x);
    return (e2x - 1) / (e2x + 1);
  }
};

/** Built-in activation functions */
export class Activations {
  public static TANH: ActivationFunction = {
    output: x => (Math as any).tanh(x),
    der: x => {
      let output = Activations.TANH.output(x);
      return 1 - output * output;
    }
  };
  public static RELU: ActivationFunction = {
    output: x => Math.max(0, x),
    der: x => x <= 0 ? 0 : 1
  };
  public static SIGMOID: ActivationFunction = {
    output: x => 1 / (1 + Math.exp(-x)),
    der: x => {
      let output = Activations.SIGMOID.output(x);
      return output * (1 - output);
    }
  };
  public static LINEAR: ActivationFunction = {
    output: x => x,
    der: x => 1
  };
}

/** Build-in regularization functions */
export class RegularizationFunction {
  public static L1: RegularizationFunction = {
    output: w => Math.abs(w),
    der: w => w < 0 ? -1 : (w > 0 ? 1 : 0)
  };
  public static L2: RegularizationFunction = {
    output: w => 0.5 * w * w,
    der: w => w
  };
}

/**
 * A link in a neural network. Each link has a weight and a source and
 * destination node. Also it has an internal state (error derivative
 * with respect to a particular input) which gets updated after
 * a run of back propagation.
 */
export class Link {
  id: string;
  source: Node;
  dest: Node;
  weight = Math.random() - 0.5;
  isDead = false;
  /** Error derivative with respect to this weight. */
  errorDer = 0;
  /** Accumulated error derivative since the last update. */
  accErrorDer = 0;
  /** Number of accumulated derivatives since the last update. */
  numAccumulatedDers = 0;
  regularization: RegularizationFunction;

  /** 1st & 2nd moment vector for weight */
  mWeight = 0;
  vWeight = 0;

  /**
   * Constructs a link in the neural network initialized with random weight.
   *
   * @param source The source node.
   * @param dest The destination node.
   * @param regularization The regularization function that computes the
   *     penalty for this weight. If null, there will be no regularization.
   */
  constructor(source: Node, dest: Node,
      regularization: RegularizationFunction, initZero?: boolean) {
    this.id = source.id + "-" + dest.id;
    this.source = source;
    this.dest = dest;
    this.regularization = regularization;
    if (initZero) {
      this.weight = 0;
      this.mWeight = 0;
      this.vWeight = 0;
    }
  }
}

/**
 * Builds a neural network.
 *
 * @param networkShape The shape of the network. E.g. [1, 2, 3, 1] means
 *   the network will have one input node, 2 nodes in first hidden layer,
 *   3 nodes in second hidden layer and 1 output node.
 * @param activation The activation function of every hidden node.
 * @param outputActivation The activation function for the output nodes.
 * @param regularization The regularization function that computes a penalty
 *     for a given weight (parameter) in the network. If null, there will be
 *     no regularization.
 * @param inputIds List of ids for the input nodes.
 */
export function buildNetwork(
    networkShape: number[], activation: ActivationFunction,
    normalization: String,
    outputActivation: ActivationFunction,
    regularization: RegularizationFunction,
    inputIds: string[], initZero?: boolean): Node[][] {
  let numLayers = networkShape.length;
  let id = 1;
  /** List of layers, with each layer being a list of nodes. */
  let network: Node[][] = [];
  for (let layerIdx = 0; layerIdx < numLayers; layerIdx++) {
    let isOutputLayer = layerIdx === numLayers - 1;
    let isInputLayer = layerIdx === 0;
    let currentLayer: Node[] = [];
    network.push(currentLayer);
    let numNodes = networkShape[layerIdx];
    for (let i = 0; i < numNodes; i++) {
      let nodeId = id.toString();
      if (isInputLayer) {
        nodeId = inputIds[i];
      } else {
        id++;
      }
      let node = new Node(nodeId,
          isOutputLayer ? outputActivation : activation, normalization, initZero);
      currentLayer.push(node);
      if (layerIdx >= 1) {
        // Add links from nodes in the previous layer to this node.
        for (let j = 0; j < network[layerIdx - 1].length; j++) {
          let prevNode = network[layerIdx - 1][j];
          let link = new Link(prevNode, node, regularization, initZero);
          prevNode.outputs.push(link);
          node.inputLinks.push(link);
        }
      }
    }
  }
  return network;
}

/**
 * Runs a forward propagation of the provided input through the provided
 * network. This method modifies the internal state of the network - the
 * total input and output of each node in the network.
 *
 * @param network The neural network.
 * @param inputs The input array. Its length should match the number of input
 *     nodes in the network.
 * @return The final output of the network.
 */
export function forwardProp(network: Node[][], inputs: number[], normalization: String): number {
  let inputLayer = network[0];
  if (inputs.length !== inputLayer.length) {
    throw new Error("The number of inputs must match the number of nodes in" +
        " the input layer");
  }
  // Update the input layer.
  for (let i = 0; i < inputLayer.length; i++) {
    let node = inputLayer[i];
    node.output = inputs[i];
  }
  for (let layerIdx = 1; layerIdx < network.length; layerIdx++) {
    let currentLayer = network[layerIdx];
    // Update all the nodes in this layer.
    for (let i = 0; i < currentLayer.length; i++) {
      let node = currentLayer[i];
      node.updateOutput();
    }
    if (normalization === "Layer" && layerIdx < network.length - 1) {
      const layerSize = currentLayer.length;

      // cal mean
      let mean: number = 0;
      for (let i = 0; i < layerSize; i++) {
        let node = currentLayer[i];
        mean += node.output;
      }
      mean /= layerSize;
  
      // cal var
      let variance: number = 0;
      for (let i = 0; i < layerSize; i++) {
        let node = currentLayer[i];
        variance += (node.output - mean) ** 2;
      }
      variance /= layerSize;
  
      // normalized
      for (let i = 0; i < layerSize; i++) {
        let node = currentLayer[i];
        node.output = (node.output - mean) / Math.sqrt(variance + node.lnEpsilon);
        node.output = node.lnGamma * node.output + node.lnBeta;
      }
    }
  }
  return network[network.length - 1][0].output;
}

/**
 * Runs a backward propagation using the provided target and the
 * computed output of the previous call to forward propagation.
 * This method modifies the internal state of the network - the error
 * derivatives with respect to each node, and each weight
 * in the network.
 */
export function backProp(network: Node[][], target: number,
    errorFunc: ErrorFunction): void {
  // The output node is a special case. We use the user-defined error
  // function for the derivative.
  let outputNode = network[network.length - 1][0];
  outputNode.outputDer = errorFunc.der(outputNode.output, target);

  // Go through the layers backwards.
  for (let layerIdx = network.length - 1; layerIdx >= 1; layerIdx--) {
    let currentLayer = network[layerIdx];
    // Compute the error derivative of each node with respect to:
    // 1) its total input
    // 2) each of its input weights.
    for (let i = 0; i < currentLayer.length; i++) {
      let node = currentLayer[i];
      node.inputDer = node.outputDer * node.activation.der(node.totalInput);
      node.accInputDer += node.inputDer;
      node.numAccumulatedDers++;
    }

    // Error derivative with respect to each weight coming into the node.
    for (let i = 0; i < currentLayer.length; i++) {
      let node = currentLayer[i];
      for (let j = 0; j < node.inputLinks.length; j++) {
        let link = node.inputLinks[j];
        if (link.isDead) {
          continue;
        }
        link.errorDer = node.inputDer * link.source.output;
        link.accErrorDer += link.errorDer;
        link.numAccumulatedDers++;
      }
    }
    if (layerIdx === 1) {
      continue;
    }
    let prevLayer = network[layerIdx - 1];
    for (let i = 0; i < prevLayer.length; i++) {
      let node = prevLayer[i];
      // Compute the error derivative with respect to each node's output.
      node.outputDer = 0;
      for (let j = 0; j < node.outputs.length; j++) {
        let output = node.outputs[j];
        node.outputDer += output.weight * output.dest.inputDer;
      }
    }
  }
}

/**
 * Updates the weights of the network using the previously accumulated error
 * derivatives.
 */
export function updateWeights(network: Node[][], learningRate: number,
    regularizationRate: number) {
  for (let layerIdx = 1; layerIdx < network.length; layerIdx++) {
    let currentLayer = network[layerIdx];
    for (let i = 0; i < currentLayer.length; i++) {
      let node = currentLayer[i];
      // Update the node's bias.
      if (node.numAccumulatedDers > 0) {
        node.bias -= learningRate * node.accInputDer / node.numAccumulatedDers;
        node.accInputDer = 0;
        node.numAccumulatedDers = 0;
      }
      // Update the weights coming into this node.
      for (let j = 0; j < node.inputLinks.length; j++) {
        let link = node.inputLinks[j];
        if (link.isDead) {
          continue;
        }
        let regulDer = link.regularization ?
            link.regularization.der(link.weight) : 0;
        if (link.numAccumulatedDers > 0) {
          // Update the weight based on dE/dw.
          link.weight = link.weight -
              (learningRate / link.numAccumulatedDers) * link.accErrorDer;
          // Further update the weight based on regularization.
          let newLinkWeight = link.weight -
              (learningRate * regularizationRate) * regulDer;
          if (link.regularization === RegularizationFunction.L1 &&
              link.weight * newLinkWeight < 0) {
            // The weight crossed 0 due to the regularization term. Set it to 0.
            link.weight = 0;
            link.isDead = true;
          } else {
            link.weight = newLinkWeight;
          }
          link.accErrorDer = 0;
          link.numAccumulatedDers = 0;
        }
      }
    }
  }
}

/** Iterates over every node in the network/ */
export function forEachNode(network: Node[][], ignoreInputs: boolean,
    accessor: (node: Node) => any) {
  for (let layerIdx = ignoreInputs ? 1 : 0;
      layerIdx < network.length;
      layerIdx++) {
    let currentLayer = network[layerIdx];
    for (let i = 0; i < currentLayer.length; i++) {
      let node = currentLayer[i];
      accessor(node);
    }
  }
}

/** Returns the output node in the network. */
export function getOutputNode(network: Node[][]) {
  return network[network.length - 1][0];
}



/* My work
==============================================================================*/

/**
 * Updates the weights of the network with Adam 
 */
export function updateWeightsWithAdam(network: Node[][], learningRate: number,
    regularizationRate: number, iteration: number, beta1 = 0.9, beta2 = 0.999, epsilon = 1e-8) {
  const alpha = learningRate;
  const t = iteration; // Training iteration count

  for (let layerIdx = 1; layerIdx < network.length; layerIdx++) {
    let currentLayer = network[layerIdx];
    for (let i = 0; i < currentLayer.length; i++) {
      let node = currentLayer[i];

      // --- Update bias with Adam ---
      if (node.numAccumulatedDers > 0) {
        // Get gradient
        const gBias = node.accInputDer / node.numAccumulatedDers;

        // Update 1st and 2nd moment estimates
        node.mBias = beta1 * node.mBias + (1 - beta1) * gBias;
        node.vBias = beta2 * node.vBias + (1 - beta2) * gBias * gBias;

        // Compute bias-corrected 1st and 2nd moment estimates
        const mHatBias = node.mBias / (1 - Math.pow(beta1, t));
        const vHatBias = node.vBias / (1 - Math.pow(beta2, t));

        // Update bias
        node.bias -= alpha * mHatBias / (Math.sqrt(vHatBias) + epsilon);
        node.accInputDer = 0;
        node.numAccumulatedDers = 0;
      }

      // --- Update weights with Adam ---
      for (let j = 0; j < node.inputLinks.length; j++) {
        let link = node.inputLinks[j];
        if (link.isDead) continue;

        if (link.numAccumulatedDers > 0) {
          // Get gradient
          const gWeight = link.accErrorDer / link.numAccumulatedDers;

          // Update 1st and 2nd moment estimates
          link.mWeight = beta1 * link.mWeight + (1 - beta1) * gWeight;
          link.vWeight = beta2 * link.vWeight + (1 - beta2) * gWeight * gWeight;

          // Compute bias-corrected 1st and 2nd moment estimates
          const mHatWeight = link.mWeight / (1 - Math.pow(beta1, t));
          const vHatWeight = link.vWeight / (1 - Math.pow(beta2, t));

          // Compute regularization derivative
          let regulDer = link.regularization ? link.regularization.der(link.weight) : 0;

          // Update weight
          link.weight = link.weight - alpha * (
              (mHatWeight / (Math.sqrt(vHatWeight) + epsilon)) +
              regularizationRate * regulDer
          );

          // Handle L1 regularization case (weight pruning)
          if (link.regularization === RegularizationFunction.L1 &&
              link.weight * (link.weight - alpha * regularizationRate * regulDer) < 0) {
            link.weight = 0;
            link.isDead = true;
          }

          link.accErrorDer = 0;
          link.numAccumulatedDers = 0;
        }
      }
    }
  }
}

export function forwardPropWithBatch(network: Node[][], inputs: number[][]): number[] {
  let inputLayer = network[0];

  if (inputs[0].length !== inputLayer.length) {
    throw new Error("The number of inputs must match the number of nodes in" +
        " the input layer");
  }
  for (let layerIdx = 0; layerIdx < network.length; layerIdx++) {
    inputs.forEach((input, bni) => {
      if (layerIdx === 0) {
        for (let i = 0; i < inputLayer.length; i++) {
          let node = inputLayer[i];
          node.batchOutput[bni] = input[i];
        }
      } else {
        let currentLayer = network[layerIdx];
        // Update all the nodes in this layer.
        for (let i = 0; i < currentLayer.length; i++) {
          let node = currentLayer[i];
          node.updateBatchOutput();
          if (layerIdx === network.length - 1) {
          } else {
            node.batchNormalization()
          }
        }
      }
    })
  }
  return network[network.length - 1][0].batchOutput;
}

export function backPropWithBatch(network: Node[][], targetBatch: number[],
    errorFunc: ErrorFunction): void {
  targetBatch.forEach((target, k) => {
    let outputNode = network[network.length - 1][0];
    outputNode.outputDer = errorFunc.der(outputNode.batchOutput[k], target);

    for (let layerIdx = network.length - 1; layerIdx >= 1; layerIdx--) {
      let currentLayer = network[layerIdx];
      for (let i = 0; i < currentLayer.length; i++) {
        let node = currentLayer[i];

        node.inputDer = node.outputDer * node.activation.der(node.totalBatchInput[k]);
        node.accInputDer += node.inputDer;
        node.numAccumulatedDers++;
      }

      for (let i = 0; i < currentLayer.length; i++) {
        let node = currentLayer[i];
        for (let j = 0; j < node.inputLinks.length; j++) {
          let link = node.inputLinks[j];
          if (link.isDead) {
            continue;
          } 
          link.errorDer = node.inputDer * link.source.batchOutput[k];
          link.accErrorDer += link.errorDer;
          link.numAccumulatedDers++;
        }
      }
      if (layerIdx === 1) {
        continue;
      }
      let prevLayer = network[layerIdx - 1];
      for (let i = 0; i < prevLayer.length; i++) {
        let node = prevLayer[i];
        node.outputDer = 0;
        for (let j = 0; j < node.outputs.length; j++) {
          let output = node.outputs[j];
          node.outputDer += output.weight * output.dest.inputDer;
        }
      }
    }
  })
}