import { Response as BoltzmannResponse } from "../../pages/api/v2/ronindojo/boltzmann";

/**
 * Transforms matLnkProbabilities data from Boltzmann response into a format
 * suitable for Chart.js Sankey chart.
 *
 * @param data - The Boltzmann response data
 * @returns An array of objects with from, to, and flow properties for the Sankey chart
 */
export function transformBoltzmannDataForSankey(data: BoltzmannResponse) {
  const inputNodes = data.txos.inputs.map((_, index) => ({ name: `IN.${index}` }));
  const outputNodes = data.txos.outputs.map((_, index) => ({ name: `OUT.${index}` }));
  const result = {
    nodes: [...inputNodes, ...outputNodes],
    links: [] as { source: string; target: string; value: number }[],
  };

  // If matLnkProbabilities is null or empty, return 100% linkage
  if (!data.matLnkProbabilities || data.matLnkProbabilities.length === 0) {
    if (data.txos.inputs.length > 0 && data.txos.outputs.length > 0) {
      for (const [inputIndex] of data.txos.inputs.entries()) {
        for (const [outputIndex] of data.txos.outputs.entries()) {
          result.links.push({
            source: `IN.${inputIndex}`,
            target: `OUT.${outputIndex}`,
            value: 100,
          });
        }
      }
    } else {
      result.nodes = [];
    }
    return result;
  }

  // matLnkProbabilities is a list of lists where each list corresponds to an output
  // and each item in that list corresponds to an input
  for (let outputIndex = 0; outputIndex < data.matLnkProbabilities.length; outputIndex++) {
    const outputProbabilities = data.matLnkProbabilities[outputIndex];

    for (const [inputIndex, probability] of outputProbabilities.entries()) {
      result.links.push({
        source: `IN.${inputIndex}`,
        target: `OUT.${outputIndex}`,
        value: Number((probability * 100).toFixed(0)),
      });
    }
  }

  return result;
}
