const axios = require('axios');

let rodada_atual;
axios({
    method: 'get',
    url: 'https://api.cartolafc.globo.com/mercado/status',
    responseType: 'json'
}).then((response) => {
    if(response.data.status_mercado !== 1) process.exit(1);
    console.log("Mercado aberto.");
    rodada_atual = response.data.rodada_atual;
    startBuilding()
});

let getDados = (playerid, cb) => {
    axios({
        method: 'get',
        url: 'https://api.cartolafc.globo.com/auth/mercado/atleta/'+playerid+'/pontuacao',
        responseType: 'json',
        headers: {
            "X-GLB-Token": "118c9ee6c1abcda1b2fb2cb7d805e5e65507a716255377541785879677474386f4544493844504d3972656b766d686469386d674a347778533264322d4761786775575267736b465272444d4232333441417a46727032754347677645544c71386d6e335647773d3d3a303a757666687573796b7373646f616f6c6778727870"
        }
    }).then((response) => {
        cb(response.data)
    }).catch((err) => {
        console.log(err);
    });
}

let getTimeClass = (teamId, rodada, cb) => {
    axios({
        method: 'get',
        url: 'https://api.cartolafc.globo.com/partidas/'+rodada,
        responseType: 'json'
    }).then((response) => {
        let posicao;
        response.data.partidas.forEach((data) => {
            if(data.clube_casa_id === teamId) posicao = data.clube_casa_posicao
            if(data.clube_visitante_id === teamId) posicao = data.clube_visitante_posicao
        })
        if(posicao >= 7) cb(3)
        if(posicao < 7 && posicao >= 12) cb(2)
        if(posicao < 12) cb(1.2)
    }).catch((err) => {
        console.log(err);
    });
}

let getLastThreeGamesClass = (teamId, cb) => {

    getLastThreeGames(teamId, (primeiro, segundo, terceiro) => {
        getTimeClass(primeiro, (rodada_atual - 1), classUm => {
            getTimeClass(segundo, (rodada_atual - 2), classDois => {
                cb(classUm, classDois)
                /*getTimeClass(terceiro, (rodada_atual - 3), classTres => {
                    cb(classUm, classDois, classTres)
                })*/
            })
        })
    })

}

let getLastThreeGames = (teamId, cb) => {
    getAgainst(teamId, (rodada_atual - 1), primeiro => {
        getAgainst(teamId, (rodada_atual - 2), segundo => {
            cb(primeiro, segundo)
            /*getAgainst(teamId, (rodada_atual - 3), terceiro => {
                cb(primeiro, segundo, terceiro);
            })*/
        })
    })
}

let getAgainst = (teamId, rodada, cb) => {
    axios({
        method: 'get',
        url: 'https://api.cartolafc.globo.com/partidas/'+rodada,
        responseType: 'json'
    }).then((response) => {
        response.data.partidas.forEach((data) => {
            if(data.clube_casa_id === teamId) cb(data.clube_visitante_id)
            if(data.clube_visitante_id === teamId) cb(data.clube_casa_id)
        })
    }).catch((err) => {
        console.log(err);
    });
}


let startBuilding = () => {
    console.log("Iniciando analise...")
    axios({
        method: 'get',
        url: 'https://api.cartolafc.globo.com/atletas/mercado',
        responseType: 'json'
    }).then((response) => {
        response.data.atletas.forEach(jog => {
            getDados(jog.atleta_id, (dados) => {
                getLastThreeGamesClass(jog.clube_id, (ultima, penultuma, tresAtras) => {
                    let rating1 = dados[rodada_atual - 1].pontos * ultima;
                    let rating2 = dados[rodada_atual - 2].pontos * penultuma;
                    let rating3 = dados[rodada_atual - 3].pontos * tresAtras;
                    let rating_final = (rating1 + rating2 + rating3) / 3;

                    console.log(rating_final)

                    //ver contra qual time vai ser
                })
            });
        });
    }).catch((err) => {
        console.log(err);
    });
};

