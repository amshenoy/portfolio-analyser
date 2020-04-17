		importScripts('https://cdnjs.cloudflare.com/ajax/libs/mathjs/6.6.0/math.min.js');
		
		function arr_shift(arr, n){
			arr.splice(-1,n);
			arr.unshift(...Array(n).fill(0));
			return arr;
		}
		
		// Column Pairwise Covariance
		function cov(a, b){
			var av_a = math.mean(a);
			var av_b = math.mean(b);
			
			var cov = 0;
			var n = a.length;
			for (var i=0; i < n; i++){ 
				cov += (a[i] - av_a) * (b[i] - av_b) ;
			}
			return (cov / (n-1)) 
		}
			
		function calc_ret(weights, mean_returns){
			var dotprod = math.dotMultiply(mean_returns, weights);
			return math.sum( dotprod );
		}
		
		function calc_std(weights, cov_matrix){
			var covdotw = math.multiply(cov_matrix, weights);
			return math.sqrt(math.multiply(math.transpose(weights), covdotw));
		}
		
		function calc_ret_std(weights, mean_returns, cov_matrix){
			//Calculate return and std dev (risk)
			ret = calc_ret(weights, mean_returns);
			std = calc_std(weights, cov_matrix);
			return [ret, std];
		}
		
		function calc_neg_sharpe(weights, mean_returns, cov_matrix, free_rate = 0){
			var [p_ret, p_std] = calc_ret_std(weights, mean_returns, cov_matrix);
			return -(p_ret - free_rate) / p_std;
		}
		
		function stocks_allocation(total_amount, asset_prices, weights){
			var count = math.floor(math.dotDivide(math.multiply(total_amount, weights), asset_prices));
			var new_weights = math.dotDivide(count, math.sum(count));
			return [new_weights, count];
		}
		
		///////////////////////////////////////////////////////////////////////////////////////////
		///////////////////////////////////////////////////////////////////////////////////////////
		
		function preprocess(stocks, data){
			//sim requirement
			var N = stocks.length; 
			//sim requirement
			var asset_prices = JSON.parse(JSON.stringify(data)).map(function(col) {return col[col.length-1]});
			
			var data_shift = JSON.parse(JSON.stringify(data));
			data_shift.map(function(col) { return arr_shift(col, 1) }); // pandas dataframe shift
			var data_returns = math.dotDivide(math.subtract(data, data_shift), data_shift);
			data_returns.map(function(col){ col[0] = 0; return col;});
			
			//sim requirement
			var mean_daily_returns = math.mean(data_returns, 1);
			
			//sim requirement
			//var cov_matrix = nj.zeros([N,N]);
			var cov_matrix = [...Array(N)].map(x=>Array(N).fill(0));
			for (var i=0; i < N; i++){
				for (var j=0; j < N; j++){
					//cov_matrix.set( i,j, cov(data_returns[i], data_returns[j]) );
					cov_matrix[i][j] = cov(data_returns[i], data_returns[j]);
				}
			}
			
			return [asset_prices, mean_daily_returns, cov_matrix];
		}
		
		///////////////////////////////////////////////////////////////////////////////////////////
		
		function simulate(stocks, data, free_rate, total_amount, prune){
			
			var [asset_prices, mean_daily_returns, cov_matrix] = preprocess(stocks, data);
			
			// 250 market days in a year
			var annual_periods = 250;
			var eps = 20000;
			
			var allocate = (total_amount != 0);
			var N = stocks.length;
			
			// MONTE CARLO DATA
			var [returns, risks, sharpes, portfolios, stock_counts] = [[], [], [], [], []];

			for (var i=0; i < eps; i++){
				
				//generate random portfolio weights summing to 1
				//var weights = nj.random(N);
				//weights = nj.divide(weights, weights.sum()).tolist();
				var weights = math.random([N]);
				weights = math.dotDivide(weights, math.sum(weights));
				
				var updated_weights;
				if (allocate == true){
					[updated_weights, stock_count] = stocks_allocation(total_amount, asset_prices, weights);
					stock_counts.push(stock_count);
				}else{
					updated_weights = weights;
				}
				
				//Calculate expected return and volatility of portfolio
				var [pret, pstd] = calc_ret_std(updated_weights, mean_daily_returns, cov_matrix);

				//Convert results to annual basis, calculate Sharpe Ratio, and store them
				var total_return = math.multiply(pret, annual_periods);
				var total_risk = math.multiply(pstd, math.sqrt(annual_periods));
				var sharpe_ratio = (total_return - free_rate)/total_risk;
				
				//////////////////////////////////////////////////////////////
				//prune!!!
				if (allocate){
					var non_existent = !portfolios.includes(updated_weights); // plotting is faster
				}else{
					var non_existent = true; //simulation is faster
				}
				
				if (prune){
					
					if (returns.length <= 200 && risks.length <= 200){
						var mean_return = 0;
						var mean_risk = 1;
					}else{
						var mean_return = math.mean(returns);
						var mean_risk = math.mean(risks);
					}
					
					if ( non_existent && total_return > mean_return && total_risk < mean_risk){
						
						returns.push(total_return);
						risks.push(total_risk);
						sharpes.push(sharpe_ratio);
						portfolios.push(updated_weights);
						
					}
					
				}else{
					if (non_existent){
						returns.push(total_return);
						risks.push(total_risk);
						sharpes.push(sharpe_ratio);
						portfolios.push(updated_weights);
					}
				}
				
				// returns.push(total_return);
				// risks.push(total_risk);
				// sharpes.push(sharpe_ratio);
				// portfolios.push(updated_weights);
				//////////////////////////////////////////////////////////////
			}
			
			return [returns, risks, sharpes, portfolios, stock_counts];
		}
		
		
		self.onmessage = function(event) {
			[stocks, data, free_rate, total_amount, prune] = event.data;
			console.log("Starting Simulation...");
			var sim_data = simulate(stocks, data, free_rate, total_amount, prune);
			console.log("Simulation Complete!")
			self.postMessage(sim_data);
		}