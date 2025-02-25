import { IUniform, Material, MathUtils } from 'three'
import { iCSMProps, iCSMShader } from './types'

import * as PATCH_MAP from './patchMaps'

export default class CustomShaderMaterial extends Material {
  uniforms: { [key: string]: IUniform<any> }
  private base: Material

  constructor(
    baseMaterial: iCSMProps['baseMaterial'],
    fragmentShader?: iCSMProps['fragmentShader'],
    vertexShader?: iCSMProps['vertexShader'],
    uniforms?: iCSMProps['uniforms'],
    opts?: any
  ) {
    // @ts-ignore
    const base = new baseMaterial(opts)
    super()
    this.base = base

    this.uniforms = uniforms || {}

    for (const key in this.base) {
      // @ts-ignore
      if (this[key] === undefined) this[key] = 0
      // @ts-ignore
      this[key] = this.base[key]
    }
    this.update(fragmentShader, vertexShader, uniforms)
  }

  update(
    fragmentShader: iCSMProps['fragmentShader'],
    vertexShader: iCSMProps['vertexShader'],
    uniforms: iCSMProps['uniforms']
  ) {
    this.generateMaterial(fragmentShader, vertexShader, uniforms)
  }

  private generateMaterial(
    fragmentShader: iCSMProps['fragmentShader'],
    vertexShader: iCSMProps['vertexShader'],
    uniforms: iCSMProps['uniforms']
  ) {
    const parsedFragmentShdaer = this.parseShader(fragmentShader)
    const parsedVertexShdaer = this.parseShader(vertexShader)

    this.uniforms = uniforms || {}
    this.customProgramCacheKey = () => {
      return this.uuid
    }

    this.onBeforeCompile = (shader) => {
      if (parsedFragmentShdaer) {
        const patchedFragmentShdaer = this.patchShader(parsedFragmentShdaer, shader.fragmentShader, PATCH_MAP.FRAG)

        shader.fragmentShader = patchedFragmentShdaer
      }
      if (parsedVertexShdaer) {
        const patchedVertexShdaer = this.patchShader(parsedVertexShdaer, shader.vertexShader, PATCH_MAP.VERT)

        shader.vertexShader = '#define IS_VERTEX;\n' + patchedVertexShdaer
      }

      shader.uniforms = { ...shader.uniforms, ...this.uniforms }
      this.uniforms = shader.uniforms
      this.needsUpdate = true
    }
  }

  private patchShader(
    customShader: iCSMShader,
    shader: string,
    patchMap: {
      [key: string]: {
        [key: string]: any
      }
    }
  ): string {
    let patchedShader: string = shader

    Object.keys(patchMap).forEach((name: string) => {
      Object.keys(patchMap[name]).forEach((key) => {
        if (customShader.main.includes(name)) {
          patchedShader = replaceAll(patchedShader, key, patchMap[name][key])
        }
      })
    })

    patchedShader = patchedShader.replace(
      'void main() {',
      `
          ${customShader.header}
          void main() {
            vec3 csm_Position;
            vec3 csm_Normal;

            #ifdef IS_VERTEX
              csm_Position = position;
            #endif

            #ifdef IS_VERTEX
              csm_Normal = normal;
            #endif

            vec4 csm_DiffuseColor = vec4(1., 0., 0., 1.);
            vec4 csm_FragColor = vec4(1., 0., 0., 1.);
            float csm_PointSize = 1.;

            ${customShader.main}
          `
    )

    patchedShader = customShader.defines + patchedShader

    return patchedShader
  }

  private parseShader(shader?: string): iCSMShader | undefined {
    if (!shader) return
    const parsedShader: iCSMShader = {
      defines: '',
      header: '',
      main: '',
    }

    const main = shader.match(/void\s*main\s*\w*\s*\([\w\s,]*\)\s*{([\w\W]*?)}/g)

    if (main?.length) {
      const mainBody = main[0].match(/\{((.|\n)*?)\}/g)

      if (mainBody?.length) {
        parsedShader.main = mainBody[0]
      }

      const rest = shader.replace(main[0], '')
      const defines = rest.match(/#(.*?;)/g) || []
      const header = defines.reduce((prev, curr) => prev.replace(curr, ''), rest)

      parsedShader.header = header
      parsedShader.defines = defines.join('\n')
    }

    return parsedShader
  }
}

const replaceAll = (str: string, find: string, rep: string) => str.split(find).join(rep)
